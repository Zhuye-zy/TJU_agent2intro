# R2消息示例（协议示例，不是真实运行证据）

POST /api/chat/stream，Content-Type: application/json，Accept: text/event-stream：
```json
{"request_id":"00000000-0000-4000-8000-000000000001","session_id":"00000000-0000-4000-8000-000000000002","message_id":"00000000-0000-4000-8000-000000000003","message":"写一段欢迎新同学的导游开场白，不编造校史。","mode":"content_generation","campus_id":"weijinlu","selected_building_id":null,"selected_poi_id":null,"generation":{"type":"guide_script","requirements":"面向首次来校的访客","length":"short","style":"friendly"}}
```

示例SSE只展示增量格式，真实实现须有accepted与唯一终态：
```text
id: 00000000-0000-4000-8000-000000000004
event: answer_delta
data: {"event_id":"00000000-0000-4000-8000-000000000004","request_id":"00000000-0000-4000-8000-000000000001","seq":3,"type":"answer_delta","timestamp":"2026-09-14T00:00:00Z","payload":{"text":"（仅格式示例）欢迎来到天津大学。"}}

```
M0端点实际返回HTTP501 ApiError，不发送上述模拟内容，不把它写入正常运行日志。

目录：GET /api/knowledge/pois?campus_id=weijinlu&category=library&limit=20。实现后的真实空结果：
```json
{"items":[],"total":0,"next_cursor":null,"version":null}
```
M0未实现返回501，不能把空数组当D已完成采集。
原取消：POST /api/requests/{request_id}/cancel，body={"session_id":"..."}；局部等待取消与upstream_stop分开。
渲染回执：POST /api/runtime/generation-rendered，需要event_id/request_id/session_id/message_id/campus_id/answer_chars；只在非空完整内容实际渲染后发，服务器核验，不接受“模型成功”自声明。
按需路线使用RouteRequest，origin仅来自用户授权高德定位，不在文档放假用户位置；目的为已校验实体ID。POST /api/maps/routes，缺key503/map_not_configured；失败保留外部导航。
