# C 行程与模型交接 — R3 第一轮

## 状态与基线

- **PARTIAL；已停止修改：是。** 公共字段缺口、D当前路线/门禁资料和现场验收仍待协调，不能判整条可执行游览已验收。
- 工作树：`E:\AI4TJU\.worktrees\api`；分支：`work/api`。
- `BASE_COMMIT_R3` / `r3-launch` / M的R3_READY回执：`0bf2e4bc8f49a9697878eaf0db614a1017ace5c1`。
- 已同步COORD_COMMIT：无；未改M冻结文件、公共router、依赖锁或A/B/D目录，未推送、未合并。
- 协调提交：`94c3e0c`；实现：`961238a`；审计修复：`30e38d7`。最终交付提交为本交接文件所在提交，精确SHA由交付消息报告（避免提交内自引用哈希）。
- 路径：`backend/model/**`、`backend/maps/cost_service.py`、`tests/model/**`、`tests/maps/test_tour_costs.py`及本C交接/协调文档。

## 接口与实际复用

M的现有tour router通过原Protocol注入`tour_service`与`cost_service`，状态现为`implemented`，不是fixture。旧聊天与三类文本生成继续保留。

|入口|实现与边界|
|---|---|
|POST `/api/tours`|真实D目录→有界候选池（最多12个常规候选加必去）→一次原GLM候选建议→程序校验ID/校区/约束→draft或infeasible。候选不合规采用目录草稿并提示；模型失败保留真实错误，不伪造成功。|
|GET `/api/tours/{id}?session_id=`|内存权威快照，隔离返回副本；会话不匹配不泄露任务；闲置1小时过期。|
|POST `/api/tours/{id}/commands`|check/start/arrive/explain/complete_stop/next/pause/resume/cancel/save/forget；check增计划版本，其余仅执行版本。到达仅用户确认；完成状态不代表真实扬声器或实地到达。|
|POST `/api/tours/{id}/revisions`|replace_stop/remove_stop/set_remaining_time；已完成和跳过站点锁定；修改当前站先pause。保留完成站ID、停留与用途；替换生成新stop_id；原必去/避开/起终点约束继续有效；不可行修改不覆盖原计划。|
|POST `/api/tours/restore`|要求saved=true及同session；存活任务返回服务端新状态；其他快照重查POI/校区/进度顺序、时效和证据，丢弃客户端事实/路线/用途；新tour_id，active→paused，不播放音频。|
|POST `/api/maps/route-costs`|校验所有public POI，仅返回相邻路段；当前无D路段成本资料，因此数值全部null。无厂商请求、无矩阵穷举、无预算重置。|

- 双版本必填，幂等作用域(session_id,request_id)，指纹包含路径/任务/正文。先查重放再查版本；处理中409；异文同ID409；成功和失败结果均有界保留。返回副本不可修改服务器状态。
- 原runtime同会话单并发/128运行上限、原取消路由和事件继续唯一使用；提交前再查版本、取消与120秒期限，中间无await。测试覆盖provider吞掉取消仍不落库/不写历史。
- Tour和幂等各最多1000；有界过期墓碑防止最近过期ID静默重用。墓碑也最多1000，进程重启/墓碑淘汰后的永久去重不承诺；客户端必须永不主动复用UUID。
- 计时按真实单调时钟向下取整到分钟；连续状态操作不会清零分钟余量。pause冻结，resume继续；暂停边界不足一分钟的余量不累计，当前不是秒级导航计时器。
- 没有第二套LLM历史。成功完整轮次才提交原HistoryStore，失败/取消不提交；恢复不导入聊天。使用现有provider实际usage和runtime阶段耗时。

## 需求、证据与时间

`backend/model/tour_planner.py:understand`为C内部需求解析入口，提取数字分钟/小时、兴趣文本、`必去X`/`不去X`/`避开X`、`从X出发`/`终点是X`、轮椅/无障碍/步行偏好。实体以D的名称/别名严格匹配，歧义或无匹配集中放warnings；文字时长/起终点与结构输入冲突必须重新澄清。缺正式自然语言字段时暂读interests，不接受模型自由编造地点。

`TourStop.visit_minutes`只表示规划分配；`Planner.schedule(plan)`输出每站相对到达/离开分钟，未知路段使后续时间为null。没有出发日期/时刻字段，因此不编造今日钟点安排；HTTP通过stops/legs/warnings表达冻结契约范围内的安排。

`TourCatalog`读同一LocalKnowledge目录及同一`facts.json`，不建新POI库、不读取坐标。证据直接绑定原子fact ID和原文结论，区分supports与retrieved；历史状态保留historical，开放/入口/预约等无有效期限不升级今日核验。资料适用日期写入claim，未提供明确标注。既有verified表示D原记录状态，不是本轮重新现场核验。

D可通过同源`tour_evidence(poi_id,campus_id)`提供Evidence列表；C会重新检查形状、时间、时效和敏感文字。`Planner(directory,costs,model_service)`可注入同一`estimate(RouteCostRequest)->RouteCostResponse`接口，隔离成本夹具即使用此接口。生产CostService保守unknown，待D提供可回查路段资料后由C明确接入，不能将夹具成本放入生产。

原guide_script在同session唯一active行程中绑定当前已到达站点，错站拒绝；`explanation_context`返回真实站点/双版本/证据/适用性要求，原生成流程接收该上下文并共用B原播放链。关键事实的资料可回查，但模型逐句结论支持校验仍需M/D独立评审，现有正文引用机制不能冒称逐句事实核验。

精确位置字段不进模型，用户文本/生成要求在搜索和模型前净化，HistoryStore写入时再次净化；兼容JSON和URL编码坐标文本。三位以上小数采用保守过滤，可能同时移除非位置的小数表述。保存恢复只检查自由文本字段，不误把UTC时间的小数秒当位置。

## 对照与指标

`backend/model/tour_evaluation.py:compare_entry(mode, request, tour_request)`提供`direct_glm`、`baseline`、`enhanced`。baseline用`git show 0bf2e4b:backend/model/service.py`载入M保存的真实类/函数，校验不可移动标签，不重写基线算法；只去掉模块全局实例初始化，注入现有provider/HistoryStore。每个样本/方案使用新session；增强另给同题冻结结构要求。此为Python验收入口，新增HTTP评测端点需要M装配。

`TourService.metrics[(session_id,request_id)]`返回任务完成状态、模型/联网搜索/地图操作次数、失败重试、首可见正文时间、耗时、usage覆盖。增强不额外联网搜索；web_calls为应用搜索调度次数，**不是搜索服务内部HTTP次数或厂商扣费次数**。非流式first_content_ms表示完整正文首次可用时间，不是流式首Token时间。幂等重放不增调用。unknown保持null，任务尚未执行不算完成；有未知路线的constraint_passed保持null。

`evaluation_record`导出M冻结EvaluationRecord；额外指标暂放C内部导出。没有有效完成任务分母，不计算Token/成功游览任务效率；不估价、不推测隐藏推理用量。

## 验证证据

### 隔离 / 本地检查

- `scripts/check-r3.ps1`：构建通过，既有前端/地图/语音/传输70项通过，R3传输2项通过，schema/types无漂移。该次后端108项通过。
- 最终代码：`CAMPUS_WEB_SEARCH_ENABLED=false .venv/Scripts/python.exe -m pytest -p no:langsmith -q`：**112 passed**；仅Starlette既有弃用提示。新增C行程/地图成本28项（27行程+1成本）。
- 包括可行/不可行、unknown、限制通行、无资料、同名、跨校区、非法模型ID、第二站替换、缩时、完成站保留、失败修改原子性、重复/冲突/处理中、提交前版本竞争、provider吞取消、暂停计时、过期ID、保存篡改与恢复、讲解当前站绑定、文本坐标等。
- 首次未按check-r2前置环境直接跑时，2个旧检索测试受到真实搜索结果影响、地图JS缺构建产物；正式关闭搜索/构建适配器后通过，未通过修改业务削弱断言。
- [C-state-example.json](C-state-example.json)：**仅算法夹具**，包含完成首站、第二站暂停后保存及新服务恢复的完整合法TourSession；不是实地/模型/地图证据。

### 真实模型 / HTTP（与上面分开）

本机忽略目录中的脱敏真实调用记录，日期2026-09-15，代码`961238a5e291ac8c27e96db1c405b64a325cf7cc`。显式AI4TJU_ENV_FILE读取根.env，不复制密钥；6次有限模型调用，不自动重试。后续`30e38d7`仅隐私/恢复/中文审计修复，未重复计费对照；最终修复覆盖隔离测试。

窗口原始量化调用记录由M归档至本机忽略目录 .runtime/M1-R3/window-metrics。

这是1个同题样本的调用元数据，不是D冻结独立题集，不足以推断总体性能胜负。三类生成的visit_plan由基线原类验证，guide/social由现有HTTP验证；最终UI流式/听音不是本次真实验收对象。

地图：本次真实配置JS/security存在、REST key未配置；实际成本HTTP200且unknown_only=true。**本轮未新增真实步行调用**。既有生产navigate实测见`docs/WEB_SEARCH_VALIDATION.md`：2026-09-15 IP区域中心→目的地4888米/3910秒/19步；该历史证据没有复制成行程路段成本，也不代表设备位置或现场通行。本轮保留原地图链并通过隔离回归。

## 待M/D/A协调及剩余问题

详见[已提前提交的协调请求](../../requests/C/R3-contract-gaps.md)。

1. **skip/end公共动作未冻结**：内部`_transition`实现并测试，现TourCommand拒绝这两个字面值；HTTP不可用。M需扩展enum/TS/schema和终止语义；不能让A发送未经契约支持的动作。
2. **需求/澄清/步行上限/出发日期及明确风险确认字段未冻结**：当前warnings集中澄清后重新create，不能在原结构外暗加字段；check→start是两次显式操作，checked不代表路线已验证。
3. **D当前核心线资料、可追溯成本与独立题集尚未交付**：未知保留草稿、null和提示；不宣称60分钟实地可行、入口开放或最优路线。严格今日开放/逐句讲解证据仍需D/M验收。
4. **真实现场尚未验**：导航定位授权、手动真实到达、中文可听播放、移动端、A显式保存/刷新、偏航处理由A/B/M联合补验；本轮仅C服务和真实模型，不以API状态代替现场。
5. A先用原runtime取消正在执行的同session请求，再发送pause/cancel任务命令；原runtime单并发仍生效。保存快照由A白名单本机存储，C不保存位置/录音/完整提示词。
6. 比赛规则、统计样本量、价格与评测字段扩展未提供；不计算推测评分/成本。当前live同题只验证入口和真实usage。

矩阵映射：T01/T02/T04—T11/T13/N01/N02/N03/E02在C所属后端隔离范围通过；T03/T08/T09/T10涉及浏览器、地图和音频的部分仍待联调；D01/D02/E01依赖D；X03完整真实60分钟场景NOT_TESTED。

**已停止修改：是。交由M独立评审和集成；不自动合并或发布。**
