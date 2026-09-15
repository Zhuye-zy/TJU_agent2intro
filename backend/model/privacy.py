"""Conservative location privacy before model/search/history/saved-tour boundaries."""
import re

_COORDINATES = re.compile(
    r'(?i)(?:\b(?:lat(?:itude)?|lon(?:gitude)?|lng)\b|纬度|经度)\s*[=:：]?\s*[-+]?\d+(?:\.\d+)?'
    r'|(?<![\d.])[-+]?\d{1,3}\.\d{3,}(?![\d.])'
    r'|\d{1,3}\s*[°度]\s*\d{1,2}[\s′分\x27]+\d+(?:\.\d+)?[″秒\x22]*'
)


def redact_coordinates(text: str) -> str:
    # Three-decimal numeric values are conservatively removed even from JSON or
    # encoded URL parameters. The tour prompt never needs precise numeric places.
    return _COORDINATES.sub('[位置已移除，请使用导航位置入口]', text)


def has_coordinates(text: str) -> bool:
    return bool(_COORDINATES.search(text))
