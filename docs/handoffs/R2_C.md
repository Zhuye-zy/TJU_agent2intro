# C-R2 模型、编排、运行日志与地图后端交接

状态：PARTIAL。模型非流式、真 SSE、三类生成和隔离测试已完成；本机没有高德三类配置，在线地图真实调用标记为 BLOCKED_REAL_API。A Web 客户端、B 语音队列、D R2 点位/检索实现未修改。

## 复用与实现

- 继续请求完整接口 http://111.32.22.35:32592/mgate/v1/chat/completions，SDK base_url 截止 /mgate/v1，请求模型固定 glm-5.1，密钥仅由后端显式环境文件读取。
- 复用 OpenAI Python SDK 3.13 的 AsyncOpenAI、Chat Completions、AsyncStream SSE/UTF-8 解码，没有另建聊天协议或手写网络 chunk 解析器。
- 复用 LangGraph 1.2.11 固定 intent → retrieval → answer → scene_action 工作流。路由是 fixed_route；没有假设 native tools。生成和聊天共用 provider、history、实体校验、引用校验和动作发布。
- POST /api/chat/stream 按 R2 契约输出 accepted/status/retrieved sources/answer_delta/cited sources/action/usage/唯一终态。只让 content 进入正文；reasoning、心跳和 usage-only 不显示、不播报、不写普通日志。
- 总截止时间 120 秒、可见正文无进展 60 秒、正文上限 23000 字。流连接在退出时关闭；本地取消和上游 unconfirmed 分开记录。
- 后端只在 generation-rendered 收到并校验 A 的实际回执后记录 rendered；模型完成时不会伪造。
- 脱敏运行记录追加到未跟踪 .runtime/model-r2.jsonl 与 .runtime/map-r2.jsonl；隔离 pytest 不写这些文件。字段含 request_id、action/type、attempt、stage/status、单调时间、elapsed、HTTP 状态、finish_reason、正文长度、真实 usage 或 null、SSE Content-Type。提示词、答案、reasoning、密钥、精确坐标不入日志。

## 生成故障根因

1. 旧 /api/chat 使用 v1 ChatRequest，无法携带 R2 generation，导致类型/长度/风格丢失。现明确返回 VALIDATION_ERROR，生成使用 /api/chat/stream。
2. “这里/刚才那个”判断曾跨模式提前返回。现仅在校园事实、场景动作或依赖实体的生成且确实未选点位时追问；“刚才那个回答”普通追问会使用受控历史。
3. 指定 glm-5.1 的最小非流式请求成功，但网关曾返回部署标识 glm-51-fp8；旧代码严格字符串相等而误报 model_mismatch。现请求模型仍固定 glm-5.1，只接受实测出现的 glm-5.1/glm-51-fp8，分别记录请求与返回标识，其他标识仍拒绝。
4. 原 R2 流式和地图端点是 501 stub。现真异步消费上游 SSE；非 SSE Content-Type 明确报 UPSTREAM_PROTOCOL_ERROR，不伪造打字、不重复执行降级请求。

错误分类已统一为 NOT_CONFIGURED、VALIDATION_ERROR、UPSTREAM_AUTH_ERROR、RATE_LIMITED、UPSTREAM_TIMEOUT、NETWORK_ERROR、UPSTREAM_PROTOCOL_ERROR、EMPTY_OUTPUT、INCOMPLETE_OUTPUT、CANCELLED。HTTP 200、仅 reasoning、未执行 tool_calls、空正文或 finish_reason=length 不算完整成功。

## 真实 API 验证（2026-09-14）

所有记录均为脱敏数据。请求未携带 tools、JSON schema、图片、音频、reasoning_effort 或 thinking 参数；stream 探测仅增加 stream=true 和 stream_options.include_usage=true。

|通路|样本|成功|延迟中位数|范围|失败|
|---|---:|---:|---:|---:|---:|
|固定问题非流式全文|3|3|23750 ms|20657–24562 ms|0|
|固定问题流式首正文|3|3|14500 ms|7156–15719 ms|0|
|固定问题流式全文|3|3|15421 ms|7453–16469 ms|0|

流式 3 次均为 text/event-stream，首正文按真实 content 计。小样本只描述观察值，不作统计显著性承诺。脱敏 request_id：

- 非流式：8c78a750-1203-4b65-acca-724b8f308b85、b4911fdf-6d3e-44c6-b87f-b3ddcf82a253、25da0cc2-6df6-456c-8f96-d6e9d6aa82ff
- 流式：70c3723b-457c-433c-9f92-7e338a2ae7e4、836e7eed-6b71-4f76-b9a4-aaa9e0a16159、94548145-cb76-438d-b8ac-b12693144ea6
- 三类生成：欢迎词 2ea1781d-a466-418d-98a8-b57a5bcff642（139 字/10813 ms）；已核验郑东图书馆讲解稿 1d3434a3-3d60-4014-81e4-218af1284006（247 字/24890 ms）；真实已知点位游览建议 a87522eb-fff2-478c-a27c-b04cb2c9d5a4（220 字/10532 ms）。三者均 completed。
- 一问一追问修复后：cbcfb45e-317e-4e85-b2d0-c05032fe5e70（129 字/26547 ms）与 be6299e4-0ebc-49a0-9a60-2d409aec5043（45 字/7469 ms），同一 session，均真实上游成功。

## 地图能力矩阵

|能力|状态|说明|
|---|---|---|
|本地点位/名称外部导航|实现|消费 D 实体；无验证坐标时用高德名称搜索，不把首个模糊结果绑定实体|
|验证入口坐标外部导航|实现|只使用 D 返回的 GeoLocation，按 CRS 显式标注且不重复转换|
|高德 JS 安全代理|实现、在线未配置|固定 host/path/参数 allowlist；服务端注入 JS Key 与安全密钥，不接受任意 URL/客户端 key|
|步行规划|实现、在线未配置|固定 /v3/direction/walking；只接受 GCJ02 用户位置与验证入口，采用高德 distance/duration，不用直线距离冒充|
|限流/去重/取消|实现|route_id 去重、同 session 单请求、6/min/session、30/min/global、并发 2；本地停止与上游确认分开|
|POI 2.0 在线目录分页|未接入|本轮不越权替代 D 的采集/实体匹配；C 代理已限制分页参数，D 合并后再做端到端核验|

本机 CAMPUS_AMAP_JS_KEY、CAMPUS_AMAP_SECURITY_KEY、CAMPUS_AMAP_WEB_SERVICE_KEY 均未配置，隔离测试与真实未配置状态分列，在线调用为 BLOCKED_REAL_API。若 M 将用户提供的高德信息写入未跟踪后端环境，需保持三类 key 分离后重启 C 后端再做少量在线验证。

## 验证

- C 隔离测试：22 passed，覆盖无 usage、空正文、401、429、超时、网络、非 JSON、reasoning-only、length、任意 SSE 字节切块/中文拆分/CRLF/心跳/usage-only、唯一终态、受控历史、重复路线、缺 key、代理白名单、入口与名称导航。
- 全仓测试：除 3 个 M-owned 旧占位断言外通过。失败项仍期待第一轮小写错误码或 /api/chat/stream 返回 501；R2 实现按新契约返回统一大写错误码和真实 SSE，需由 M 更新共享测试。
- 未修改人物设定、A 页面、B 队列/语音、D 采集/检索、公共契约、入口装配、依赖清单或锁文件。Web 端 POST SSE 解码、客户端总超时/断网兜底、TTS/实际播放延迟仍需 A/B/M 集成验证。
