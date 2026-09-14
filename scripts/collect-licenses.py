"""Collect actual installed license texts for direct dependencies; never reads configuration."""
import importlib.metadata as md
import json, re, shutil
from pathlib import Path
root=Path(__file__).resolve().parents[1]
dest=root/"docs"/"licenses"; dest.mkdir(parents=True,exist_ok=True)
inventory=[]
package=json.loads((root/"package.json").read_text())
for name in {**package["dependencies"],**package["devDependencies"]}:
    folder=root/"node_modules"/name
    meta=json.loads((folder/"package.json").read_text())
    target=dest/re.sub(r"[^a-zA-Z0-9_.-]","_",name); target.mkdir(exist_ok=True)
    copied=[]
    for p in folder.iterdir():
        if p.is_file() and re.match(r"^(licen[cs]e|copying|notice)",p.name,re.I):
            shutil.copyfile(p,target/p.name); copied.append(str((target/p.name).relative_to(root)))
    inventory.append(dict(ecosystem="npm",name=name,version=meta["version"],license=meta.get("license"),license_files=copied))
for name in ["fastapi","uvicorn","openai","edge-tts","langgraph","pydantic-settings","httpx","pytest","pydantic"]:
    dist=md.distribution(name)
    target=dest/name; target.mkdir(exist_ok=True)
    copied=[]
    for relative in dist.files or []:
        p=dist.locate_file(relative)
        if p.is_file() and any(x.lower().startswith(("license","copying","notice")) for x in relative.parts):
            filename="__".join(relative.parts[1:])
            shutil.copyfile(p,target/filename); copied.append(str((target/filename).relative_to(root)))
    inventory.append(dict(ecosystem="python",name=name,version=dist.version,license=dist.metadata.get("License-Expression") or dist.metadata.get("License"),license_files=copied))
(root/"docs"/"DEPENDENCY_LICENSES.json").write_text(json.dumps(inventory,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print("Recorded",len(inventory),"installed dependency license entries")
