# M1 集中装配
四窗口交付后由M在 review/r3-integration 修复；原工作树不自动同步。
- 知识投影 ApplicableEvidence 增加可空 source_url，来自同一个 fact 的来源；保留 source_ref 原子事实 ID。TS/schema/OpenAPI 同步。
- SpeechController 的 replay/continueRemaining 接受可选 SpeechRun，以沿用唯一队列并绑定新的播放上下文；旧无参调用兼容。
- start/resume 未核实确认不足返回 TOUR_UNVERIFIED_ACK_REQUIRED (422)。
- D同一LocalKnowledge实现 get_tour_context/get_tour_route_costs；C默认采用D核心参观点；不把馆内藏品默认当校园步行站。
- A任务讲解共用行程session，停止原请求后才发变更；识别文本的明确缩时指令进入C版本化修订。
- 用户保存的刷新恢复先暂停。门禁、成本未知不升级核验，校门回环最后一站需确认完成。
验证与问题闭环见 REVIEW、REWORK、FINAL_REPORT。业务窗口已停写，最终基线以M集成候选为准，不移动r3-launch。
