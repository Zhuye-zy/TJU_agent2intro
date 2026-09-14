# R2 所有权（在原分支增量修复）

优先级：本轮用户最新补充 → 本文及 R2/CONTRACTS → 第一轮契约。产品名称继续为珂莱塔。M0 只冻结接口和准备环境，不替各窗口完成业务。

|窗口|唯一可编辑路径|职责|
|---|---|---|
|A|frontend/src/ui/**、frontend/src/scene/**、frontend/public/ui/**、tests/ui/**、docs/R2/handoffs/A.md、docs/requests/A/**|唯一客户端会话/生成状态、流消费、结果渲染及回执、校区快照；本地图缩放/点选/检索联动、高德JS/授权定位/外部导航按钮/路线展示、背景渲染。|
|B|frontend/src/avatar/**、frontend/src/speech/**、backend/speech/**、tests/speech/**、docs/R2/handoffs/B.md、docs/requests/B/**|现有角色与语音适配、跨chunk净化、串行队列、增量/全文/选段、自动播报、捕获及音频资源释放。实际音频回调驱动speaking，不持全局会话或另调LLM。|
|C|backend/model/**、backend/maps/**、tests/model/**、tests/maps/**、docs/R2/handoffs/C.md、docs/requests/C/**|内容生成P0、原模型适配/固定工作流/唯一受限历史、SSE与终态/日志/回执、地图真实配置和安全代理、按需路线限频/取消。禁止改客户端状态和后端语音。|
|D|backend/knowledge/**、data/knowledge/**、frontend/public/assets/campus/**、tests/knowledge/**、docs/R2/handoffs/D.md、docs/requests/D/**|原存储扩展；独立事实/实体/别名、目录分页/检索评测、双校区本地图及图面标注、地理坐标和通行依据核验、实景媒体及许可清单。禁止把示意坐标当经纬度。|
|M|以上之外全部|共享契约/入口/传输薄层/依赖锁/脚本/规范/基线/验收/最终装配。|

M 独占 backend/contracts.py、backend/r2_contracts.py、backend/common/**、backend/app.py、shared/**、frontend/src/{main.tsx,transport/**}、根配置/锁/README/AGENTS、scripts/**、tests/test*_contracts.py及原公共契约测试、docs/R2/{BASELINE,CONTRACTS,OWNERSHIP,PARALLEL_RUN,ACCEPTANCE_MATRIX}.md。
A 使用 M 的 r2Transport.openStream/createSseParser，在自己的 ui 内建立唯一流消费者；不能修改 M 的 transport。B 使用 createSpeechController 导出，A 只调用冻结 API；如需可选参数先提协调请求。
D 的新接口与旧 buildings/search 必须是同一资料源的不同视图。C 的流式与旧 /chat 必须复用同一 provider/runtime/history，不能另建会话存储。

状态责任：A 持请求/校区/会话 generation ID 和展示状态。B 持音频 generation ID、FIFO及播放器，发真实 SpeechProgress。A 根据 B 实际 speaking 回调装配 AvatarAdapter；不能用“拿到文本/音频URL”提前进入 speaking。B 不修改 A 的 messages/prefs/loading。
素材只从项目内相对 URL 运行。D 不动珂莱塔素材；B 不提交原始人物/SDK包。校园图片的合法副本由 D 管，不得用生成图冒充实景。

第一轮交接保存在 docs/handoffs/；R2 写新的 docs/R2/handoffs/，不覆盖旧证据。每个窗口遵守 GitHub 审核门禁，提交自己分支并等待用户在 M1 指定合并。
