# A 前端/场景交接 · 2026-09-14

状态：**PARTIAL（A 范围实现与构建通过；B/C/D 真实模块尚未集成，统一开发预览受 M 共享配置阻塞）**

## 实际完成

- 将 M0 检查页改为直接可操作的“海小棠数字人校园导游”工作台：主舞台突出人物与校园点位，右侧为对话，来源随答案展开，运行日志为抽屉；桌面与小屏均有响应式布局，没有桌宠、伴侣、游戏或营销首页功能。
- 复用 React 19 的 hooks 状态能力、M0 的同源 `transport`/冻结 contracts，以及 B 暴露的 `createAvatarAdapter`、`createSpeechAdapter`。没有复制 OLV/AIRI UI 源码，没有新增依赖或改锁文件。
- AvatarAdapter 挂载区为大尺寸舞台；`idle/listening/thinking/speaking/error` 由请求与语音事件驱动。renderer 未 ready 时只显示“人物渲染尚未接入”及文字身份印记，不生成替代人物。
- 三种模式、校区选择、D 建筑列表/资料卡、`selected_building_id` 和“介绍这里”已接入冻结 transport。只实现 `CampusCardSceneAdapter(kind=2d)`，执行后发送 scene ack；没有可用 3D 入口。
- 每次发送/重试创建新 `request_id`；清空先停止进行中工作并创建新 `session_id`。IME composition 期间 Enter 不发送。前端只保留展示缓存，不把 history 发给后端，也不持有密钥。
- 非流式请求显示明确等待文字，不做打字机伪流式。应用在线、模型配置存在、模型真实连通分开显示；网络失败、空答案、取消与服务不可用有独立状态。
- 取消先阻止旧回调并停止本地等待/播放，再以独立请求调用 chat cancel 与 speech stop。session/request/generation 三重守卫保护聊天、ASR、TTS 和动作回调，旧结果不会写回新会话。
- 语音识别文字默认写入输入框等待确认；提供回答播放、停止与自动播报。按 adapter capability 检查 ASR/TTS，检查中文音色，区分权限拒绝和播放/服务失败。
- 日志只合并 `/runtime/events` 实际返回内容，按 `(origin,event_id)` 去重、最多 500 条，区分后端/浏览器及 stage，缺耗时显示“未返回”。当前会话导出移除原始 request/event ID，只保留白名单事件元数据；空页面不生成初始日志。
- 回答使用 React 节点解析有限 Markdown（段落、列表、粗体、代码与 http(s) 链接），未使用 `dangerouslySetInnerHTML`。来源只展示响应中的 `sources`，并再次限制链接协议。
- 本机偏好仅保存校区、自动播报、人物缩放和背景；不保存完整聊天、密钥或日志。外观定制只按人物真实 capability 提示；缩放/背景明确属于显示设置。

## 验证

- `npm run typecheck`：通过。
- `node --test tests/ui/model.test.ts`：7/7 通过，覆盖新 ID、旧回调守卫、日志去重/容量、脱敏导出、安全链接、取消与网络失败文案。
- `npm run build`：通过（Vite 132 modules；最终产物约 JS 246 kB、CSS 19 kB，gzip 约 78 kB/5 kB）。
- 构建产物预览 `http://127.0.0.1:5174/`：HTML、JS、CSS 均返回 200。
- 浏览器 UI 自动化：本轮 Computer Use 返回“无可用浏览器”，未完成真实截图、点击、IME 或 viewport 缩放验收。

## 已知限制与协调请求

- A 分支仍是 M0 的 StubAvatarAdapter/StubSpeechAdapter，health 的 chat/knowledge/语音能力为 false，知识计数为 0；因此未宣称真实人物、语音、模型、知识或场景联调整体通过。等待 M 合并 B/C/D 后复验。
- 统一命令启动的 Vite 开发页返回 403：`server.fs.allow` 被解析为 `frontend/frontend` 与 `frontend/shared`。A 未越权修改 `vite.config.ts`；复现和建议见 `docs/requests/A/vite-dev-fs-allow.md`。
- 字体使用系统字体栈，无外部字体请求；实际中文字形、人物素材尺寸与 B renderer 的 canvas 适配需集成后浏览器目视复验。

## 交接结论

A 授权范围内的产品界面、交互状态、2D 卡片执行与关键自动检查已完成。M 需先处理 Vite 协调请求，再在集成分支合入 B/C/D 后按统一命令完成真实后端、人物、语音、点位和浏览器验收。
