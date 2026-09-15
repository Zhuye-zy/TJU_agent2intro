# R3 路径所有权

优先级：本次用户指令 → R3契约/本文 → 当前代码和较新实测 → R2及更早历史文档。四窗只在自己的原工作树开发。M0准备完不代做业务。

|窗口|唯一业务可写路径|本轮负责|
|---|---|---|
|A|frontend/src/ui/**、frontend/src/scene/**、frontend/public/ui/**、tests/ui/**|行程卡/移动端导览、唯一UI和请求生命周期、地图装配、B事件业务决策、保存偏好及刷新流程|
|B|frontend/src/avatar/**、frontend/src/speech/**、backend/speech/**、tests/speech/**|真实中文ASR往返、连续采集、插话、同一播放队列、实际播放回调、基础音频RMS嘴形|
|C|backend/model/**、backend/maps/**、tests/model/**、tests/maps/test_*.py|结构化计划权威状态/版本/幂等/恢复、唯一原HistoryStore、证据选择/约束/usage、后端地图成本及代理|
|D|backend/knowledge/**、data/knowledge/**、frontend/public/assets/campus/**、tests/knowledge/**|真实核心点与校园服务规则、别名/校区检索、证据资料、合法实景和独立题集|
|M|shared/**、backend/contracts.py、backend/r2_contracts.py、backend/r3_contracts.py、backend/common/**、backend/app.py、frontend/src/transport/**、应用入口、根配置/依赖锁/脚本、公共契约测试|共享边界、导航公共模块、传输装配、环境与发布基线、集成验收|

例外：`tests/maps/navigation.test.mjs` 始终归M，C不改公共前端导航测试。M还拥有 `tests/transport/**`、`tests/test*_contracts.py`、`tests/test_contract_boundaries.py`、`tests/r3_fixture.py`。其他已有测试所有权沿用R2。

每窗可写 `docs/R3/handoffs/<A|B|C|D>.md` 和 `docs/requests/<窗口>/**`。五份冻结文档及VERIFICATION归M。旧交接记录保留不覆盖。

M0创建 `backend/model/tour_service.py` 和 `backend/maps/cost_service.py` 仅为明确501的实现槽；R3_READY后立即归C。C按公共Protocol提供同名对象，无需编辑app.py。服务的implementation应在实际可用时改为implemented，不因对象存在置可用。

A复用 `r3Transport`、`acceptsTourResult` 和 `navigateTourStop/AmapNavigation`；不另造SDK入口、LLM历史或音频队列。B只向A回报本地事件，不直接发模型请求，不修改A的任务状态。D继续同一资料存储，不能另造无法对齐的点位库。

公共字段/依赖/根装配问题立即提请求：现象、最小复现、拟加字段/导出、涉及路径、可独立继续部分。M单独协调提交；窗口先提交自己的修改，再同步一次COORD_COMMIT，有冲突通知M，禁止整块ours/theirs。不等待M1再提阻塞。

当前只本地M0发布。后续远端PR按 `docs/REVIEW_POLICY.md`，不得因持有所有者凭据擅自合并其他人的PR。业务窗口交付必须注明已停止修改，M1才独立评审、集成、返修、真实验收。