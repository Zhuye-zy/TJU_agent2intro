# C 模型、编排与运行日志交接

状态：**PARTIAL — BLOCKED_REAL_API**。C 职责代码和隔离验证已完成；真实网关验证因未配置授权凭据而未执行，也未切换 URL 或模型伪装通过。

## 实现与开源复用

- 直接复用 `openai==3.13.0` 的 `AsyncOpenAI`、会话消息和异常类型，在 `OpenAICompatibleProvider` 中只加薄适配。后端从完整 `CAMPUS_LLM_URL` 去掉一次 `/chat/completions`，SDK 请求仍落到 `/mgate/v1/chat/completions`。请求显式 `stream=False`，未传 tools、response format、JSON schema、图片或音频参数；`max_retries=0`。
- 直接复用 `langgraph==1.2.11` 的 `StateGraph`，固定执行 `intent → retrieval → answer → scene_action`。这是后端受控固定路由，不是模型自主工具调用，也不执行模型生成的代码或任意计划。
- `HistoryStore` 是模型历史唯一所有者，只存成功的完整 user/assistant 轮次；向模型发送时最多 18 条既有消息，加当前 user 后仍小于冻结的 20 条边界，总计不超过 32000 字符。最多 1000 会话，闲置一小时淘汰。客户端仍不能提交 system/history。
- 系统提示固定在后端。检索只调用 D 的 `knowledge` 接口；校区与 `selected_building_id` 在路由和工作流中核验。“这里”无选中建筑时本地追问，有选中建筑时优先使用该对象。校园资料不可用返回 501，资料就绪但无命中返回明确的资料不足回答。
- 检索片段按不可信外部数据封装，单条和总上下文均截断。模型引用只接受 `[source:实际检索ID]`；响应 `sources` 只映射答案真正引用的命中，不把全部 hits 填入。未知 ID、无依据的校园回答或答案内 URL 均拒绝。`content_generation` 响应固定加“创作内容”标识，避免虚构内容被当作校史。
- 场景动作只由固定关键词路由生成 `focus_building/show_building_card`，再次通过 D 建筑索引和运行时登记校验。发布只产生 scene started；只有 `/api/scene/ack` 的客户端执行回执才产生 completed/failed。
- 沿用冻结的可查询内存事件存储，没有另造聊天协议。request、knowledge、model、scene 的 started/completed/failed/cancelled 均在真实发生处发出；请求运行期间即可轮询。事件只保存白名单元数据，不保存输入、完整提示词、检索全文、认证头、密钥或原始上游正文。
- `ConnectivityState` 只有收到非空、可解析的真实上游响应才把 `verified` 设为 true；usage 只取供应商同时返回的三个真实整数字段，否则为 null。缺配置、配置 URL 错误、401/403、429、网络、超时、5xx、非 JSON、空答案、超长答案和引用失败均使用不同安全错误码。原始网关正文不回显。
- 后端取消会取消当前本地等待；模型调用一旦发出，`upstream_stop` 只记 `unconfirmed`。model cancelled 与 request cancelled 分别记录。没有供应商确认机制时从不声称上游推理已停止，取消后的迟到结果不会提交历史或发布动作。

## 验证证据

执行：

```powershell
$env:PYTHONDONTWRITEBYTECODE='1'
.\.venv\Scripts\python.exe -m pytest tests\model -q
```

结果：`14 passed`。隔离 `httpx.MockTransport` 覆盖：成功且有 usage、成功无 usage、空答案、401、429、5xx、网络失败、非 JSON、超时、请求路径不重复、一次请求无自动重试、日志脱敏、运行中 started 查询、一问一追问历史、失败轮次不入历史、来源子集映射、伪造引用拒绝、选中建筑动作与执行回执。测试替身只在 `tests/model`，正常运行不加载。

全仓 `pytest -q`：`18 passed, 1 failed`。唯一失败是 M 独占的 `tests/test_contract_boundaries.py::test_stub_events_redaction_and_duplicate` 仍按 M0 stub 断言只有 request started/failed；C 实现会额外发出真实 knowledge started/completed。状态码仍为 501、错误码仍为 `not_implemented`，脱敏与重复 request_id 语义未退化。M 合并时需更新该共享基线断言。

`git diff --check` 通过。测试期间设置 `PYTHONDONTWRITEBYTECODE=1`，因为工作树基线的已存在 `backend/model/__pycache__` 文件不可写；这不影响源码执行。

## BLOCKED_REAL_API

2026-09-14 检查：主目录 `E:\AI4TJU\.env` 不存在；当前进程未设置 `CAMPUS_LLM_URL`、`CAMPUS_LLM_MODEL`、`CAMPUS_LLM_API_KEY` 或 `AI4TJU_ENV_FILE`。因此没有向真实网关发送请求，没有真实 request_id、耗时、模型结果或多轮结果可保存。未采用通用 `OPENAI_API_KEY`，未尝试候选密钥，未更换指定 `glm-5.1` 或指定网关。

凭据由 M/C 通过主目录隐藏配置补齐后，应使用 `AI4TJU_ENV_FILE=E:\AI4TJU\.env` 启动 C 后端，以两个新 UUID 在 `general_chat` 做一问一追问；只记录脱敏 request_id、耗时、响应 model、usage 是否存在和成功/失败，不记录问题全文、答案全文、头或密钥。

## M 合并协调与未集成项

- `backend/app.py` 属于 M，当前 health 仍把 `model.verified` 和 chat capability 静态写为 false。C 已导出 `backend.model.service.connectivity`，M 应在合并后让 health 读取 `configured/verified`，并保证只有真实上游成功才更新 verified。没有真实验证前必须保持 false。
- C 分支仍是 M0 的 `UnavailableKnowledge`。与 D 合并后，同一 `knowledge` 接口会提供真实建筑、状态与来源；C 没有创建平行知识库。合并时需用 D 数据重跑校园问答、引用子集、“这里”和场景动作测试。
- 语音仍完全由 B 的 SpeechAdapter/后端路由负责。C 未调用 ASR/TTS、未改 speech 文件；A 取消时仍需按契约分别请求 chat cancel 与 speech stop。
- 运行事件与历史按冻结契约是单进程有界内存，重启不持久；没有把它描述成持久审计库。若 M 后续改为 JSONL/数据库，须维持脱敏、容量、游标和去重语义。
