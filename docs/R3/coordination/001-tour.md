# COORD-001：行程约束、澄清、跳过/结束与评测
负责人M；受影响窗口 **A、C**。其他窗口无需同步此提交。以本文件所在提交为COORD_COMMIT；依赖仅r3-launch。

处理请求：A/R3-interface-gaps第1—3项，C/R3-contract-gaps的输入/动作/评测项。旧字段默认值和版本1.2.0保留，新增字段可选；只发公共契约和fixture，不带业务窗口未提交代码。

## 冻结定义

- TourRequest新增message（0—2000字自然语言）、must_visit（≤5）、avoid（≤100）POI ID列表、visit_date（ISO日期或null）、max_walking_minutes（0—240或null）。重复ID、必去/避开交集、起终点被避开返回422。C还必须核验同校区真实ID、日期与开放资料；结构字段为明确约束，message冲突须澄清，不能静默覆盖。
- 新message与原interests在传模型/存入TourPlan.request前必须由C的隐私层移除精确坐标；A同样引导位置从导航入口输入，运行日志不记录原文。已有C代码仅净化interests的地方须同时处理message。
- TourResult新增clarification_required=false、clarifications=[]。每题question_id/field/prompt/candidate_poi_ids；只允许draft/infeasible快照，flag与题集严格一致。A一次集中展示，收齐后用同session_id、新request_id提交修正后的完整TourRequest；不新建聊天历史或以warnings字符串假装结构化问题。需澄清时禁止check/start，C仍负责约束判断。
- TourCommand新增skip（必须stop_id，等于当前站）和end（不带stop_id）。skip仅active未完成当前站，A先停止该站讲解/导航，C原子标skipped并转下一pending站navigating；末站跳过则completed/current_stop_id=null。不会触发自动地图调用，A等明确导航动作。
- end仅active/paused，保留已completed站，其余标skipped，status=completed/current_stop_id=null，completion_reason=user_ended。自然走完/跳过后收尾为all_stops_resolved。旧完成快照可暂缺reason；已跳过数量独立统计，提前结束不计“完整任务成功”。cancel仍是取消，不能冒充完成。
- start/resume新增accept_unverified=false。当路线时长/通行等关键事实未知时，A展示缺口并在用户明确确认后发送true；C先检查该风险确认，再执行转换。true不能覆盖确定不可行、未解澄清或无效版本；其他action不允许true。
- EvaluationRecord新增solution_id=direct_glm|baseline|enhanced|null、comparison_group_id UUID|null、web_search_calls/failure_retries可空、first_content_ms可空、first_content_source=stream_first_visible|nonstream_response|unknown。unknown必须对应null；不能把完整非流式响应时间标成真实流式首正文。未测计数保持null，已知零才填0。原usage语义不变。

## 接线与检查

A：类型来自shared/r3.ts，原r3Transport即可传新字段；fixture支持skip/end。集中澄清/风险确认/提前结束UI与业务判断归A/C，不由M填假实现。
C：按新增字段读取输入、privacy净化、skip校验stop_id、completion_reason及真实指标导出；tour_service还需执行业务幂等/版本/状态检查。检查不应把一个成功end当完整参观完成。
C当前tour_catalog回退中的中文占位问号/按retrieved_at判verified也需自行修正；D公共资料接口另以COORD-003交付，当前不得将检索/获取时间当当前开放核验。

验证：公共契约旧输入兼容、新字段冲突/命令形状/澄清/首正文观测来源测试；schema --check、TS typecheck。fixture不替代C业务测试。

同步：先提交/妥善保存自己业务修改，再仅cherry-pick本提交，记录COORD_COMMIT。有冲突向M报告，不重置工作树，不从M整体merge拉入其他未关联协调。