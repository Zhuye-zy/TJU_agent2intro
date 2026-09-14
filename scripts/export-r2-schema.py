"""M-owned schema export. No configuration or model calls."""
from pathlib import Path
import json,sys
from pydantic import TypeAdapter
root=Path(__file__).resolve().parents[1];sys.path.insert(0,str(root))
from backend import r2_contracts as r2
names=["R2ChatRequest","POI","POIPage","KnowledgeRecord","CampusMedia","CampusMap","CampusAssets","ProviderCrosswalk","Coverage","MapStatus","MapPublicConfig","ExternalNavigation","StreamEvent","GenerationRendered","RenderReceipt","UserPosition","RouteRequest","RouteResponse","RouteCancelResponse"]
schemas={name:TypeAdapter(getattr(r2,name)).json_schema() for name in names}
(root/"shared/r2.schema.json").write_text(json.dumps({"contract_version":"1.1.0","schemas":schemas},ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print("Exported R2 schemas:",len(schemas))
