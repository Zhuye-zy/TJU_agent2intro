# COORD-003：D同库资料投影与媒体POI关联
受影响窗口 **A、C、D**；依赖仅r3-launch，与001/002独立。其他窗口无需同步。本文件所在提交为COORD_COMMIT。

## D公共接口
在现有LocalKnowledge同一对象实现：
- get_tour_context(poi_id, campus_id, visit_date: date|null=None) -> TourKnowledgeContext
- get_tour_route_costs(body: RouteCostRequest) -> RouteCostResponse
类型见backend/r3_knowledge_contracts.py和backend/common/knowledge_ports.py；TS与schema在shared/r3-knowledge.*。没有第二份数据库。

HTTP入口由M已装配GET /api/knowledge/tour-context/{poi_id}?campus_id=&visit_date=；方法未实现明确501，不返回伪造资料。C优先直接调用同一knowledge.get_tour_context；A通过tourKnowledgeContext公共transport读取。错误沿用原404/422/501；未知POI或跨校区由D校验，公共入口再次核对响应上下文。

ApplicableEvidence含poi_id/campus_id、原Evidence、claim_type、applicable_at/audience、有效日期范围、source_checked_at/field_checked_at、current_status及conflict_ids。current_status=confirmed/pending/expired/conflict/unknown。D现有metadata的conflict等状态需要明确映射，不能丢掉争议标识。
- published_rule或其他时效资料在pending/expired/conflict/unknown或存在冲突时，不能标verified。
- source_checked_at只说明原网页核对，field_checked_at是现场核对；retrieved_at不自动等于两者。
- 日期/人群/节假日适用不明，保持unknown/pending及warnings；当前日期为请求visit_date，未给定则requested_date=null，不能伪装已按当天核验。
- claim_type=stable_fact/published_rule/historical_event/field_observation。历史事件不能直接支持今日开放；C仍按具体结论判断relation。
- context版本沿用同库资料版本；route_costs只含公开点位之间有来源的成本，并引用context内独立evidence_id。没有资料时空列表；get_tour_route_costs对请求每段返回source=unknown、时间/距离null。不发设备坐标、不调用地图、不把图面距离换成实际距离。

C当前tour_catalog中按facts.retrieved_at推定verified的回退不能用作今日开放/门禁证据。接入新接口后消费ApplicableEvidence.evidence及适用元数据；不要把带额外字段的对象直接当旧Evidence验证。若保留tour_evidence兼容投影，只返回纯Evidence且不能丢失时效后升级验证等级。D路由/成本实现由D/C按所有权完成，M仅冻结边界。

## 媒体
CampusMedia增加可选poi_id=null；旧manifest保持兼容。D只在来源确认照片对应真实POI时填写，并核验该POI与campus_id相同；广角校园照或地点未确认保持null。A只用非空匹配值按站点展示，null仍可作为明确校区级图片。禁止按数组序号猜地点。原作者/来源/使用依据仍必填，不改变许可要求。

本协调涉及backend/r2_contracts.py/shared/r2.ts、r2 schema、M的app入口和新知识公共文件；没有复制D正在编辑的数据，也没有修改D业务服务。

验证：旧媒体输入兼容、关联ID格式、资料/校区一致、时效与争议降级、公开HTTP日期参数和同库调用；TS/schema检查。真实来源的准确性留D与M1独立核验。