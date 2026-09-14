# 契约 1.0.0 示例

以下是请求/响应格式说明，不是校园事实或模型实测结果。完整字段以shared/openapi.json为准。

```http
POST /api/chat
Content-Type: application/json

{"request_id":"11111111-1111-4111-8111-111111111111","session_id":"22222222-2222-4222-8222-222222222222","message":"介绍校园","mode":"campus_qa","campus_id":"weijinlu","selected_building_id":null}
```

M0真实响应为HTTP501：
```json
{"error":{"code":"not_implemented","message":"M0 模型接口已建立，真实对话由 C 实现","request_id":"11111111-1111-4111-8111-111111111111","retryable":false}}
```

随后GET /api/runtime/events?request_id=11111111-1111-4111-8111-111111111111&cursor=0，可取得本次真实request started/failed，seq和timestamp运行时生成。重复提交同ID为409；勿拿文档UUID连续当新请求ID。

GET /api/knowledge/status 的空仓响应：
```json
{"status":"unavailable","version":null,"document_count":0,"building_count":0,"updated_at":null}
```

GET /api/knowledge/search?query=图书馆&campus_id=weijinlu&limit=5 返回hits=[]并带相同status；GET /api/knowledge/buildings?campus_id=weijinlu 返回{"buildings":[]}。

取消：POST /api/requests/11111111-1111-4111-8111-111111111111/cancel，body={"session_id":"22222222-2222-4222-8222-222222222222"}。M0失败终态响应already_terminal/local_task_stopped=true/upstream_stop=not_started。

场景回执必须使用真实返回的action_id，M0没有发布动作，任何编造动作ID均404。不要为了演示回执而在正常数据中加假建筑。

未来ChatResponse字段：answer（真实文本）、sources（实际来源或[]）、model（实际模型）、usage（供应商值或null）、elapsed_ms（计时）、actions（已校验发布动作或[]），及request_id/session_id。本文件不填预设成功回答。
