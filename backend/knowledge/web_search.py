"""Bounded public web retrieval. Queries never include history or device location."""
from __future__ import annotations

import asyncio
from collections import OrderedDict
from datetime import datetime, timezone
from hashlib import sha256
import ipaddress
import re
import socket
import time
from urllib.parse import urlparse

from ddgs import DDGS
import httpx
from lxml import html

from backend.contracts import Source


def public_url(value: str) -> bool:
    try:
        p = urlparse(value)
        if p.scheme not in ("http", "https") or not p.hostname or p.username or p.password:
            return False
        if p.port not in (None, 80, 443) or "." not in p.hostname or p.hostname.endswith((".local", ".internal")):
            return False
        try:
            return ipaddress.ip_address(p.hostname).is_global
        except ValueError:
            return True
    except ValueError:
        return False


def search_query(message: str, title: str | None, campus: str) -> str:
    # Search only the current topic, never credentials, coordinates, or chat history.
    text = re.sub(r"https?://\S+|[a-fA-F0-9]{24,}|\b\d{1,3}\.\d{3,}\b", " ", message)
    text = re.sub(r"(?:api[_ -]?key|secret|密钥|密码|token)\s*[:：=]?\s*\S+", " ", text, flags=re.I)
    text = re.sub(r"请|帮我|为我|写一段|生成一段|讲解词|讲解稿|联网搜索|上网搜索|搜索一下|约?\d+字", " ", text)
    if title and title not in text:
        text = title + " " + text
    if campus and not any(x in text for x in ("天津大学", "天大")):
        text = "天津大学 " + text
    return " ".join(text.split())[:180]


class WebSearch:
    def __init__(self):
        self.cache: OrderedDict[tuple, tuple[float, list[Source]]] = OrderedDict()
        self.gate = asyncio.Semaphore(2)

    async def _page(self, client, url):
        if not public_url(url):
            return ""
        try:
            host = urlparse(url).hostname
            addresses = await asyncio.get_running_loop().getaddrinfo(host, None, type=socket.SOCK_STREAM)
            if not addresses or any(not ipaddress.ip_address(item[4][0]).is_global for item in addresses):
                return ""
            # No redirects: a public URL cannot redirect this fetch into a private network.
            async with client.stream("GET", url, follow_redirects=False) as response:
                if response.status_code != 200 or "text/html" not in response.headers.get("content-type", ""):
                    return ""
                chunks = bytearray()
                async for chunk in response.aiter_bytes():
                    chunks.extend(chunk)
                    if len(chunks) > 1_000_000:
                        return ""
            doc = html.fromstring(bytes(chunks))
            for item in doc.xpath("//script|//style|//nav|//header|//footer|//noscript"):
                item.drop_tree()
            return " ".join(doc.text_content().split())[:7000]
        except (Exception,):
            return ""

    async def search(self, query, campus, settings):
        if not settings.web_search_enabled or not query.strip():
            return [], "disabled"
        key = (query, campus, settings.web_search_backend)
        cached = self.cache.get(key)
        if cached and time.monotonic() - cached[0] < 600:
            self.cache.move_to_end(key)
            return list(cached[1]), "cached"
        async def retrieve():
            async with self.gate:
                rows = await asyncio.to_thread(lambda: DDGS(timeout=5).text(
                    query, region="cn-zh", max_results=5, backend=settings.web_search_backend))
                rows = [r for r in rows if public_url(str(r.get("href", "")))]
                # Prefer institutional sources without presenting other search hits as verified facts.
                rows.sort(key=lambda r: not urlparse(r["href"]).hostname.endswith((".edu.cn", ".gov.cn")))
                async with httpx.AsyncClient(timeout=3, headers={"User-Agent": "AI4TJU-SourceReader/1.0"}) as client:
                    pages = await asyncio.gather(*(self._page(client, row["href"]) for row in rows[:3]))
                now = datetime.now(timezone.utc).isoformat()
                sources = []
                seen = set()
                for index, row in enumerate(rows):
                    url = row["href"]
                    if url in seen:
                        continue
                    seen.add(url)
                    page = pages[index] if index < len(pages) else ""
                    body = str(row.get("body", ""))[:1000]
                    snippet = ("网页检索摘要（未读取全文）：" + body)
                    if page:
                        snippet = "已读取网页；检索摘要：" + body + "\n网页摘录：" + page[:2200]
                    sources.append(Source(id="web-" + sha256(url.encode()).hexdigest()[:16],
                        title=str(row.get("title", url))[:300], snippet=snippet, url=url,
                        campus_id=campus, published_at=None, retrieved_at=now))
                return sources
        try:
            sources = await asyncio.wait_for(retrieve(), timeout=settings.web_search_timeout)
        except Exception:
            return [], "unavailable"
        if sources:
            self.cache[key] = (time.monotonic(), sources)
            while len(self.cache) > 128:
                self.cache.popitem(last=False)
        return sources, "completed" if sources else "empty"


web_search = WebSearch()
