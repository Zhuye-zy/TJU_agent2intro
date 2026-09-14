# A-R2 交接：流式工作台、校园探索与真实状态 UI

## 基线与边界

- 工作树：`E:\AI4TJU\.worktrees\ui`
- 分支：`work/ui`
- R2 冻结基线：`e272ed9b3eb31b57868f6e1077036a896750361f`
- 开工 HEAD：`950d0b8ced1465e56343c212b24a97f23bdeb3bd`
- 仅修改 A 的 `frontend/src/ui/**`、`frontend/src/scene/**`、`tests/ui/**`、`docs/requests/A/**` 和用户指定的本文件。未改 B 人物/语音实现、C/D 服务、共享契约、入口、根脚本、依赖清单或锁文件。
- 按 R2 规则保留现有 React/Vite + Pixi Live2D 路线与“珂莱塔”人物身份，没有迁移框架或恢复桌宠功能。

## 实现结果

1. 聊天与内容生成分别持有 session、request、abort、generation 和任务列表。内容生成按契约发送 `mode=content_generation` 及 `generation.type/requirements/length/style`；空输入显示原因，同一 lane 执行中同步封锁重复发送。
2. 使用 M 提供的 `r2Transport.openStream` 与 `createSseParser`。同一任务增量更新同一消息，按 `event_id` 去重并校验递增 `seq`、accepted 快照、request/session、唯一终态；HTTP 200 空正文、自然断流、60 秒无可见正文、120 秒总超时均不显示成功。
3. 任务卡显示待开始、执行中、正在接收、完成、失败、取消，保留完整正文；支持收起/展开、复制、非空文本导出、停止、新 request_id 重试及原 request_id 关联。错误说明脱敏，并给出 request_id 和日志入口。
4. 长历史独立滚动；用户离开底部后新增 token 不抢滚动位置，并显示“回到最新”。宽屏面板可拖动调宽，小屏在“地图与导览/对话与生成”间切换。中文 IME composition 期间 Enter 不发送。
5. 只渲染经过响应契约进入任务的来源，显示短标题、引用编号与可展开摘要；正文使用 React 文本节点和受限行内 Markdown，不执行 HTML，URL 仅允许 http(s)。状态栏不显示虚构百分比或思考过程。
6. 自动简述/自动全文/关闭、停止播报、读一段、读全文全部调用 B 的唯一 `createSpeechController`；流期间只 append 文本，终态 finish，不逐 token 调用 speak。人物 speaking 状态仅来自 `SpeechProgress` 回调。ASR 继续调用 B 现有适配器，识别结果只填入输入框供确认，并有 session/request/generation/校区保护。
7. 新校园探索区消费 D 的稳定 POI ID，支持校区、分类、搜索、游标分页与去重；点位卡、列表、图面 marker、“这里”上下文共用 ID。只有真实点位才显示上下文操作，导航不可用时给出静态原因而非假链接。
8. 无 Key 时本地图/目录仍可用；有配置时由 `@amap/amap-jsapi-loader` 加载高德 JS，加载前设置同源 `serviceHost`。标记较多时启用聚合。定位只在用户点击后开始，可一次或持续并可停止；显示来源、精度与更新时间，区分拒绝、超时、IP/粗略、手动起点。浏览校区和实际位置分离。
9. 只有非粗略的已授权高德定位且服务声明 `in_app_routing=VERIFIED` 时，才允许向 C 请求路线；防连点、可取消、只绘制后端返回的真实 polyline。否则保留经后端验证的外部导航或明确说明不可用，不画直线、不承诺门禁。
10. 背景只读取 D 的 `/assets/campus/` manifest，预加载后双层 550ms 渐变，快速切换以 generation 最新值为准，遵守 reduced-motion。失败时保留中性底色、无白闪，并显示来源/许可；背景组件不包办人物、语音或会话生命周期。

## 开源复用

- 复用现有 React 19 状态与组件树、Vite 构建、Pixi Live2D `AvatarAdapter`，人物素材和状态仍由原适配层负责。
- 复用已选 `eventsource-parser` 及 M 的统一 transport，不另造 SSE/请求栈。
- 复用已锁定的 `@amap/amap-jsapi-loader`，按现有同源安全代理契约加载，不新增依赖或改锁文件。
- 语音只复用 B 的 `createSpeechController`/`SpeechAdapter`；A 没有实现第二套 TTS。

## 验收矩阵关联

| ID | A 侧状态 | 证据与待集成项 |
|---|---|---|
| G02 | 已实现，待真实集成 | 独立结果区、非空终态和 DOM 非空后 `generationRendered` 已接；C 流端点 404，无法取得三类真实截图/回执配对。 |
| G03 | 隔离通过 | 覆盖 HTTP 失败脱敏、空正文、取消、后端 error、自然 EOF、空闲超时；真实上游错误待 C。 |
| G04 | 隔离通过，待浏览器并发复验 | chat/generation 独立状态、取消与任务归属；测试覆盖跨 request 不串写。 |
| L02 | 隔离通过，待真流 | 跨 chunk、delta 合并、event_id 去重、seq/accepted/终态校验通过；C 真流未合入。 |
| L03 | 已装配，待 B/C | 第一段开始前调用唯一控制器 begin，delta append，终态 finish；真实首可听时间未测。 |
| S01 | 已装配，未真实播放 | 明确开启后才能自动播报；B 控制器当前待合入，5 连答未测。 |
| S03 | 已装配，待 B | 自动简述/全文/关闭、读一段/全文均走同一控制器；段落边界有隔离测试。 |
| S04 | 已装配，待 B | 独立停止；回答取消、清空、切校区调用 controller.stop 并推进 generation guard。 |
| S06 | 已装配，待权限实测 | ASR 默认只填输入框；权限拒绝/不可用提示与旧回调保护已接，无浏览器麦权限可测。 |
| S07 | 已装配，待真实素材/播放 | 人物状态消费 B 的真实播放回调；未以文本到达提前标 speaking。 |
| D07 | UI 已实现，待 D | 分类/搜索/完整 cursor 分页/稳定 ID 去重已接；本分支 POI 接口 404。 |
| D08 | UI 已实现，待 D | manifest、预加载、双层渐变、失败中性背景与图源信息已接；本分支无真实双校区照片接口。 |
| M01 | UI 已实现，待 D | 无 Key 本地图缩放/点选/检索/卡片保留；真实图面和点位未合入。 |
| M02 | UI 已实现，待 C/D | 只展示后端返回的安全外链并标名称搜索精度；接口未合入。 |
| M03 | NOT_CONFIGURED | 高德 loader 与同源 serviceHost 已实现；无配置且代理端点未合入，未宣称在线可用。 |
| M04 | 已实现，未浏览器实测 | 显式点击定位、一次/持续/停止、精度圈及拒绝/超时/粗略提示；无浏览器与地图配置。 |
| M05 | 已实现，待 C/配置 | 仅用户点击规划、500ms 防重、取消与真实 polyline；路线接口未合入。 |
| M07 | A 侧实现，待 C | 精确位置不进入聊天 payload、日志或导出；地图异常降级到目录。手动起点因共享类型限制只作页面参考，见协调请求。 |
| X01 | 隔离通过，待联合复验 | lane/session/request/generation 四层保护；取消后旧事件不落入新任务。 |
| X02 | A 侧实现，待 B/C/D 联合复验 | 切校区清点位/路线并停止请求和播报；实际位置不驱动浏览校区；背景最后选择优先。 |
| X03 | 静态通过，浏览器未测 | 响应式 CSS、面板拖动、移动视图、IME/空/错误态已实现。CUA 返回无 app/browser，无法截图。 |

## 验证记录

### 隔离测试（PASS）

```powershell
node --test tests/ui/model.test.ts tests/ui/r2-model.test.ts
```

结果：16 tests，16 pass。覆盖生成成功/空输入校验/后端失败/空正文/取消/断流/超时、跨 chunk 和事件去重、聊天/生成隔离、22000 字正文不截断、非空导出、历史跟随、段落拆分、照片筛选、POI 分页去重、定位粗略分类。

### 类型与构建（PASS）

```powershell
npm run typecheck
npm run build
```

两者通过；Vite 生产构建 141 modules。未改依赖和 lock。

### 本地真实进程检查（PARTIAL）

- `npm run preview -- --port 5174`：`GET /` 为 200，包含 root 容器。
- `Start-Backend.ps1 -Port 8001`：旧 `/api/health` 为 200。
- `/api/r2/pois`、`/api/r2/chat/stream`：本分支均为 404，故真实生成/错误结果、分页、双校区图片、地图、定位与语音联合链路均标待集成。
- 所有 A 测试进程已停止，5174/8001 无遗留监听。

### 浏览器与截图（NOT_TESTED）

CUA 实际返回 `apps=[]`、`browsers=[]`。没有可操作浏览器，未生成双校区、生成结果或错误态截图；没有使用 mock 截图冒充真实集成。

## 协调请求与限制

- `docs/requests/A/R2-vite-worktree-deny.md`：共享 `vite.config.ts` 的 `.worktrees` deny 规则使规定的 A dev server 自身返回 403；M 需修复，A 未越权改根配置。
- `docs/requests/A/R2-manual-origin-source.md`：共享 `UserPosition.source` 只允许 `amap_geolocation`。当前手动起点诚实标为 manual 并禁用应用内路线；若需提交手动路线，请 M/C 扩展并校验契约。
- B 的 R2 语音控制器、C 的 R2 流/地图服务、D 的 POI/图面/照片需按顺序合入后，再执行矩阵要求的真实浏览器、真实模型、地图权限与音频测试。

