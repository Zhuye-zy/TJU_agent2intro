import json
import sys
from pathlib import Path
root=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(root))
from backend.app import app
path=root/"shared/openapi.json"
path.write_text(json.dumps(app.openapi(),ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print("Exported",path)
