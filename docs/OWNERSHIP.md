# M0 路径所有权（契约 1.0.0）

主路线为组件组合，实际目录是 React/Vite 前端与 FastAPI 后端。只在自己工作树编辑下表路径；不是在集成目录并行改文件。

|窗口|允许编辑|职责与限制|
|---|---|---|
|A 前端/场景|frontend/src/ui/**、frontend/src/scene/**、frontend/public/ui/**、tests/ui/**、docs/handoffs/A.md、docs/requests/A/**|工作台、聊天显示、来源/日志、校园选择、建筑卡片、2D白名单动作执行。A唯一拥有应用交互状态、浏览器session_id、当前request_id与AbortController；只显示后端历史，不提交/累积另一份LLM上下文。向B传状态/命令，不能直接操作音频、Cubism或麦克风。|
|B 人物/语音|frontend/src/avatar/**、frontend/src/speech/**、backend/speech/**、tests/speech/**、docs/handoffs/B.md、docs/requests/B/**|renderer/manifest/capabilities、人物局部状态、ASR/TTS提供方、音频队列及停止。不得拥有全局聊天状态、历史或调用GLM。单独后端语音目录，不编辑model路由。素材仅通过本地复制脚本使用，勿提交第三方人物/音色原件。|
|C 模型/日志|backend/model/**、tests/model/**、docs/handoffs/C.md、docs/requests/C/**|指定GLM非流式首验、受限历史唯一所有者、固定工作流、真实事件、取消登记、已发布动作与回执校验。系统提示只在后端。不得编辑speech路由或实现UI。|
|D 知识|backend/knowledge/**、data/knowledge/**、tests/knowledge/**、docs/handoffs/D.md、docs/requests/D/**|真实资料采集与索引、版本统计、校区建筑ID、检索与资料出处。坐标无可靠来源填null，不能补造建筑。|
|M 总控|其余全部及合并后的公共文件|应用装配、共享契约、依赖与锁、配置/启动/构建脚本、许可证与冻结文档。|

M 独占：AGENTS.md、shared/**（含OpenAPI）、backend/contracts.py、backend/app.py、backend/common/**、frontend/src/main.tsx、frontend/src/transport/**、frontend/index.html、根 package.json/package-lock.json/pyproject.toml/uv.lock/tsconfig.json/vite.config.ts/.env.example、scripts/**、tests/test_contract_boundaries.py、docs/CONTRACTS.md、docs/OWNERSHIP.md、docs/PARALLEL_RUN.md、docs/OPEN_SOURCE_DECISION.md、THIRD_PARTY_NOTICES.md。

M0创建的stub之后归对应窗口；不要以stub由M创建为由等待M实现。若需要装配新导出或共享变更，按PARALLEL_RUN立即提阻塞请求。A可以在其App内调用冻结transport与B adapter；B仅实现既有adapter导出，避免A/B同时改App或状态context。

会话语义：A只持不含秘密的会话ID和展示消息缓存；C持用于LLM的消息历史，最多20条user/assistant消息、合计32000字符，不含system。成功才提交一个完整轮次，失败/取消不追加；同一session最多一个运行chat。最多1000会话，闲置1小时淘汰。M0尚未实现此历史存储，C不得更改约定。

## R2增量所有权
当前扩展路径和职责以[R2/OWNERSHIP.md](R2/OWNERSHIP.md)为准，仍使用原工作树；本文件保留第一轮分工历史。
