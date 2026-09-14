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



## M1-R2 返修 A01—A06（2026-09-14）

状态：PARTIAL（代码返修与隔离验证完成；真实浏览器、麦克风、人耳听音和在线地图验证仍待M）。
同步候选基线：6827a0570f4fc9d9d698af1e96beede95dd1c2cc，使用一次 git merge --ff-only。
已停止修改，可以合并：是。仅修改A的ui/scene/tests/ui及本交接。

- A01：外链渲染双重绑定稳定实体ID；切点清外链/路线，旧响应不得落到新卡片。路线结果也绑定目标。
- A02：60秒headers deadline、从提交起120秒总deadline；正文流首字/空闲计时与总时限分开。生成完成渲染回执由实际DOM effect发起，音频finish独立运行；语音播放被阻止不会让文字loading一直等待。错误、清空、切校区停止旧声音。
- A03：同chunk终态后事件拒绝；task终态不可变；completed正文和来源权威替换。来源在完成前标“检索候选”，完成后标“最终来源”。
- A04：本地目录、校园图面、地图配置分别加载，地图请求不阻塞目录；图面严格使用manifest宽高比，标注使用同一坐标平面，资料年代/非精确导航可见。在线地图只使用M的AmapNavigation+MapBudget和同一加载的AMap namespace；JS Walking优先，无REST路线调用。在线实例跨视图和校区保留，避免重复加载耗费预算。授权一次定位、停止等待、手动GCJ-02起点、路线取消、真实路线步骤和现有B控制器朗读已接。持续定位明确暂未实现，无假按钮。
- A05：ASR复用B controller.getAdapter，新增中文音色选择/刷新、恢复声音、继续讲及真实错误提示。生成“展开讲讲”沿生成session，携带受限的选中原稿文本而不建立第二套历史存储。新任务/清空/切校区失效旧ASR和音频。
- A06：目标照片加载期间保留旧层并标校区正在切换，新图成功后过渡；真实无照片/加载失败回中性背景，不用其他校区冒充。素材是否达到数量/许可目标由D/M独立核验。

### 实际验证

1. node --test tests/ui/model.test.ts tests/ui/r2-model.test.ts tests/ui/navigation.test.ts：21/21通过。新增错实体外链、旧路线、目标/校区取消代次、headers挂起/取消、终态后delta和最终来源覆盖用例。均为隔离逻辑测试，不冒充浏览器/提供方成功。
2. npm run typecheck：通过。
3. npm run build：通过，144模块。
4. scripts/Start-Frontend.ps1 -Port 5174 -ApiPort 8001：实际启动Vite，监听127.0.0.1:5174，PID 63464。GET /=200、GET /src/ui/App.tsx=200。跨树/@fs/E:/AI4TJU/.worktrees/api/frontend/src/ui/App.tsx=403。
5. 不存在的跨树.env路径返回200 text/html（534字节，应用SPA壳），未返回秘密。已通知M补前置403/404规则，A未修改共享Vite配置。
6. 上述Vite测试进程已通过自身会话Ctrl-C关闭，再查5174无监听；未动root8000。
7. 本返修真实地图加载/定位/POI搜索/步行规划调用均0。默认M预算1/1/0/1，统计应用发起次数，失败/取消不退额、刷新不重置，不代表高德平台扣减统计。

### 待M集成复验

M的7760979定位错误分类协调已在总控分支，A已接permission_denied/location_timeout/location_accuracy_unverified提示，无需重放提交。
真实三种生成页面、generation.rendered事件、5次自动可听播报、权限/精确定位/路线、桌面小屏与图片现场效果仍须M实测。API或构建不替代浏览器PASS。
最短现场流程：启动应用→双校区图面各点选/查来源→开启语音选音色→三类生成分别提交→取消/重试/继续讲→切校区确认旧声音停止→在在线配置明确时各授权一次定位/一次路线，额度用完后保留外链。
