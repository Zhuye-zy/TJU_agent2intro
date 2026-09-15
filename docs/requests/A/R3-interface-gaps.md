# A → M：R3 共享接口缺口
2026-09-15；A 树 work/ui；共同基线 0bf2e4bc8f49a9697878eaf0db614a1017ace5c1；R3_READY 已核对。

1. TourRequest 无 must_visit/avoid。拟增加同校区 POI ID 数组，由 C 验证冲突与可行性。A 暂用 interests 中明确中文约束（必去/避开地点），展示请求快照，不宣称满足。
2. TourResult 无 clarification/questions。需冻结 C 返回澄清与补充输入形状。当前 A 只显示 C 错误说明和 warnings，不伪造 C 问题。
3. TourCommand 无 skip，StopProgress 却有 skipped。需新增 skip 并明确末站转换。A 不能将完成或删除冒充跳过。
4. B interaction.ts 在启动基线缺失。A 以可选模块装配 r3-speech 入口；缺失时保留原 ASR 及默认确认模式。合入 B 后待实测。
5. CampusMedia 无 poi_id。A 只能展示同校区实景及 caption/出处，不能按数组序号猜地点。请提供 POI 关联。

涉及 M：shared/r3.ts、backend/r3_contracts.py、schema、transport；C：tour_service；B：interaction；D：媒体。A 不修改共享路径。
可继续：生命周期、已有命令/修订、保存恢复、导航桥、小屏界面、语音守卫、夹具测试。
