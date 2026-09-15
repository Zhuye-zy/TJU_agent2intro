# D R3 最终交接

## 结论与提交

**PARTIAL：资料、检索与独立题集已交付；现场通行/服务有效性和可显示实景仍有缺口。已停止修改：是。**

- 工作树：E:/AI4TJU/.worktrees/knowledge；分支：work/knowledge。
- BASE_COMMIT_R3 / r3-launch：0bf2e4bc8f49a9697878eaf0db614a1017ace5c1。
- 已核对M的R3_READY回执、D HEAD与基线文件一致；未同步额外COORD_COMMIT。
- 优化前冻结提交：5bcd28e。
- 首批供C接入的数据提交：c745587。
- 完整数据、检索及验证提交：3600d3c9c6737f3c149d93bc7959c0a1774e1a55。
- 最终停写交接提交为包含本文的提交，可用 git log -1 --format=%H -- docs/R3/handoffs/D.md 获取，聊天回执给出该最终号。提交不循环写自身哈希。
- 本轮只改backend/knowledge、data/knowledge、tests/knowledge及本文；没有修改共享契约、依赖/锁、根脚本、应用入口或其他窗口代码。没有远端推送。

## 可交付内容

|交付|位置|实际范围|
|---|---|---|
|覆盖与逐点缺失清单|[COVERAGE.md](../../../data/knowledge/r3/COVERAGE.md)|卫津路8、北洋园7核心点，共15点；全库106 POI|
|核心点审计|[core_routes.json](../../../data/knowledge/core_routes.json)|引用唯一POI ID；入口、坐标来源、访客、道路与核验日期分开，缺项pending|
|服务规则|[service_rules.json](../../../data/knowledge/service_rules.json)|28条独立规则：19条来源规则、9条历史规则；按校区投影41条事实，不虚增独立规则数|
|断言与时效|[evidence_metadata.json](../../../data/knowledge/evidence_metadata.json)|覆盖242条facts；目录断言、历史事实、来源规则、历史规则分开；现场核验均null|
|来源台账|[SOURCES.md](../../../data/knowledge/r3/SOURCES.md)|22个页面，区分发布日期、适用范围、获取时间及访问限制|
|冲突|[conflicts.json](../../../data/knowledge/r3/conflicts.json)|校史馆常设/暑期安排、餐饮内文命名差异；旧R2冲突另保留|
|C样例|[c-samples.json](../../../data/knowledge/r3/c-samples.json)|两校区各5站真实ID候选顺序；全部路段成本null，不是已验证TourPlan|
|照片候选|[media_candidates.json](../../../data/knowledge/media_candidates.json)|卫津路3个具体候选；北洋园1个全景候选+2个未经确认的校方照片线索；显示媒体0|
|固定题集|[legacy-50.json](../../../data/knowledge/r3/legacy-50.json)、[evaluation-v1.json](../../../data/knowledge/r3/evaluation-v1.json)|原40证据题+10无证据/歧义题保留；新增12服务题+8行程题，总70题|
|开发检索结果|本机忽略目录中的 verification-retrieval.json|数据版本、实现hash、题集hash、逐题命中与时延|
|验证回执|[verification.json](../../../data/knowledge/r3/verification.json)|50测试通过；明确未运行模型、地图、现场、保留题和任务评价|
|第二轮维护建议|[MAINTENANCE.md](../../../data/knowledge/r3/MAINTENANCE.md)|地点、规则、照片、临时关闭；A管理UI、M冻结写协议，本轮不做后台|

## C可直接复用

Python只读入口均在原LocalKnowledge，旧buildings与新POI从同一pois.json投影，未建立第二份地点身份库：

    from backend.knowledge.service import knowledge

    bundle = knowledge.get_core_bundle("weijinlu")
    poi = knowledge.get_poi("weijinlu-chunshui-library")
    aliases = knowledge.resolve_entities("请介绍一下北馆", "weijinlu")
    evidence = knowledge.get_evidence_record("r3-library-hours-wj")
    campus_rules = knowledge.get_service_rules("weijinlu")

- get_core_bundle返回data_version、campus_id、items（poi+audit）、rules及field_verified=false。
- get_evidence_record接受fact.id或SOURCE_REGISTRY.id。fact结果包含record、metadata、conflicts、data_version；不存在返回None。
- Evidence.source_ref优先使用具体fact.id；来源页存在不等于支持某结论。published_rule表示发表过的规则，不表示今天有效。
- metadata.field_checked_at均null；开放/入口规则valid_until缺失时不能标verified。历史通知只用于说明当时政策。
- POI.verification_status=verified沿用“名称目录已核对”含义，不能用于提升地图坐标、门禁或道路通行核验。
- 校区规则先读get_service_rules(campus_id)；带poi_id的筛选仅返回直接关联地点的规则，不包含无特定POI的校区政策。
- c-samples.json是D资料包，不是共享TourPlan请求/响应。C依冻结R3契约装配请求和Evidence，执行用户约束及状态机。
- 没有新公共HTTP端点或新依赖；现有list_pois/search/legacy views继续使用。backend/knowledge/importer.py现在要求10个受管文件的完整包，含新元数据与r3/conflicts.json；不要用旧6文件包覆盖新库。
- importer为离线校验+顺序替换/回滚，不是线上并发写协议。M冻结未来事务方案。

## 检索与评价

实际复用原关键词、中文二元组与别名方案：最长名称片段识别、全角数字归一、同校区类别候选、目录/历史/服务问题分流；未新增Embedding或reranker。

量化逐题记录由M归档至本机忽略目录 .runtime/M1-R3/window-metrics；不随远端交付。

- 已知北馆、南馆、25教及两条历史重新开放问题恢复召回；“海棠季”不再误归卫津路单点。无当天开放、施工、厕所或无障碍通行证据时不拿目录充当规则。
- 当前实际数据版本：sha256:ca65cc62c92e。旧测量版本sha256:d75f2e7e8ac0保留；M基线文档sha256:a5e0678c385d是同内容Git LF版本，已逐文件核对为LF/CRLF差异，见BASELINE_AUDIT.json。
- 新版本使用规范化JSON并纳入元数据、规则、核心点与冲突；不受换行差异影响。freeze.json原始hash保留，freeze-portability.json补充LF校验。
- 原50题已在R2公开使用，全部归开发题。新增20题中8题是保留题，D未执行或用来调优；仓库可见不宣称盲测保密。
- 每题提供预期实体、fact/source引用或硬约束。标准依据来自可回查资料与R3约束，不用模型输出当答案。
- 所有8个行程任务均交M执行（其中4开发、4保留）。测试只验证保留题引用存在，没有向检索/模型提交保留题。
- Recall@5只测预选依据能否被取回，不衡量答案真假、引用支持率或端到端任务效果；M仍需独立验收。

## 实际验证

在D工作树运行：

    .\.venv\Scripts\python.exe -B -m backend.knowledge.importer
    .\.venv\Scripts\python.exe -B -m backend.knowledge.evaluate_r3 --output data/knowledge/r3/verification-retrieval.json
    .\.venv\Scripts\python.exe -B -m pytest -p no:langsmith -p no:cacheprovider -q tests/knowledge tests/test_r3_contracts.py
    git diff --check

结果：导入校验通过；知识与R3契约50测试通过；diff检查无错误。既有Starlette/AnyIO弃用警告1项，不改依赖。测试覆盖旧端点同源身份、别名/跨校区、日期语义、元数据可追溯、版本跨换行稳定及修改失效、冻结题集、导入错误前置拒绝与回滚、候选照片不进入显示。

这些是本地JSON与TestClient/单元验证；未启动真实后端、未调用真实模型/地图、未运行R3业务fixture或浏览器现场。禁止写成端到端通过。

## 尚缺与矩阵

|矩阵|D交付状态|后续|
|---|---|---|
|D01、T02|PARTIAL|15点及28规则可查，但当日开放、校门预约、楼内访客条件与有效期、现场入口仍pending|
|D02、T07资料层|DONE（本地）|别名与题集检索通过；C/M执行实际替换站点及跨校区约束验收|
|D03|BLOCKED|两张已许可原图本轮各一次HTTP403；其他候选需主体/授权确认，可显示实景仍0|
|E01|DONE（冻结交付）|70题、hash、基线与人工可回查依据已交；M执行保留题和任务|
|N02资料层|DONE（未知诚实表达）|距离/时间均null、来源与通行核验分离；M/C验证实际路线|
|E02、X03|NOT_TESTED BY D|真实任务效果、Token及60分钟端到端由M执行|

补采重点：两校区公众入口与预约政策；各核心点现场道路、坡道/台阶/电梯、卫生间/座椅/雨天替代；图书馆访客与餐饮支付；校史馆秋季时段；每校区至少2张有作者、来源、使用依据且经过看图的实景。详见COVERAGE.md逐点清单。

**已停止修改：是。等待M独立评审、集成及现场验收；后续只在明确返修指令下继续。**
