# R2 冻结契约 1.1.0

这是第一轮 docs/CONTRACTS.md 的兼容扩展。机器定义：backend/contracts.py、backend/r2_contracts.py；前端 shared/contracts.ts、shared/r2.ts；HTTP shared/openapi.json；完整R2模型 shared/r2.schema.json。修改仅由 M 发独立协调提交。M0 新端点明确 501，既有普通聊天照常工作；不将空stub算已实现。

## 身份、校区和历史

campus_id 仅 weijinlu / beiyangyuan；中央别名见 shared/r2.ts CAMPUS_ALIASES。中文名称不能另作ID。
稳定实体ID沿用旧building ID；selected_poi_id与selected_building_id是同一个ID的兼容名，两者非空不同时422。旧 /chat 保持旧结构；新 /chat/stream 要求 message_id(UUID)。
新请求还含 request_id/session_id UUID、message 1–8000、mode三枚举、campus_id及选中实体快照。额外字段禁止；不接收system/history。unknown mode=422。
content_generation 必须 generation={type:guide_script|visit_plan|social_post,requirements:0–2000字符,length:short|medium|long,style:friendly|formal|lively}；其他mode不能带generation。生成不是建筑指代门控的默认失败分支；资料不足不编造事实。

A 只持显示缓存和ID；C 的原 HistoryStore 唯一保存LLM上下文，最多20条/32000字符/1000会话/闲置1小时。成功完整轮次才提交，取消/失败/不完整不提交。
A 聊天与生成各用独立 session_id、request_id、message_id、loading、AbortController及结果区，但同一 C 历史服务，不建立第二套服务。每条UI消息保留校区/模式快照。每个session最多1个运行请求；换校区暂停旧任务/增代/停止旧语音，旧历史可以留在原校区会话，禁止写入新校区地图、来源或语音。

## 传输与终态

|方法/路径|请求与响应|归属|
|---|---|---|
|POST /api/chat|旧ChatRequest→ChatResponse，普通非流式兼容|C原routes/service|
|POST /api/chat/stream|R2ChatRequest→text/event-stream；受理前错误ApiError|C stream_routes.py|
|GET /api/runtime/events?request_id=&cursor=|继续原EventPage真实日志轮询|C runtime|
|POST /api/requests/{request_id}/cancel|原session_id→CancelResponse|C|
|POST /api/runtime/generation-rendered|GenerationRendered→RenderReceipt|C校验、A实际渲染后提交|
|POST /api/scene/ack|旧SceneAck→SceneAckResponse|C发布校验，A执行|
|POST /api/speech/*、GET /api/speech/voices|原ASR/TTS/stop/audio协议保留|B|

SSE每记录 UTF8：id: event_id；event: type；data: 单行JSON的StreamEvent；空行结束。A fetch POST+TextDecoder(stream:true)+直接依赖eventsource-parser；不使用原生EventSource发GET另开会话。不自动重连或重放POST。
envelope固定 event_id/request_id/seq/type/timestamp/payload；seq为单请求递增从1开始，和RuntimeEvent全局seq不是同一游标，禁止混用。事件ID去重、request_id不匹配拒收。类型及精确payload见shared/r2.ts。
accepted含session/message/campus/mode快照；status只描述开始；answer_delta只新增可见正文，禁止reasoning；sources区分retrieved和cited；poi_action沿用已发布SceneAction；usage真实或null；completed.response是最终正文、来源、model、usage、elapsed_ms、actions权威状态。
终态 completed/error/cancelled 恰好一次。只有收到有效非空最终正文、允许的finish_reason、正确模型且业务完成才completed。HTTP200、reasoning-only、空正文、自然EOF、仅一段token均不算成功。
断流/超时/finish_reason=length且已有正文：error.code=INCOMPLETE_OUTPUT，partial=true，保留answer、reason=disconnect|timeout|length；不能计生成成功。没有正文则partial=false，对应empty/upstream等安全类别。主动取消只发cancelled，不再补error。
应用总请求时限120秒、可见正文空闲上限60秒（accepted/心跳/推理不重置首正文等待），最大正文23000字；A可显示经过时间但不能伪造进度或打字流。C 在超时后关闭连接，未获上游确认仍unconfirmed。
EOF前没有终态时，A建立本地transport error视图并保留partial，不能冒充收到后端终态；停止本地等待与取消端点响应分别记录。
请求ID重复在原runtime保留期内409，不自动换ID重试；用户“重试”才创建新ID。正文流不作为完整提示词/正文运行日志持久保存。
C emit generation.started/completed/failed/cancelled（RuntimeEvent stage=generation；failed对应协议error）。A非空完整生成结果实际渲染后发 generation-rendered，不发model成功事件。服务端校验session/request/message/campus、生成模式、已完成且非空正文及字符数；event_id去重、每request/message最多1次有效渲染回执；重复一致返回duplicate、冲突409，不信任客户端随意成功声明。
RuntimeEvent保留origin/backend/frontend，增加stage=generation和status=rendered；公共ClientEventInput仍只允许speech/avatar，不允许客户端构造model事件。保留ring2000/request1024/并发128/1h TTL和白名单脱敏，只记ID、阶段、耗时、数量、模型/安全错误码；精确坐标、URL查询密钥、认证头、完整录音/提示词/隐藏推理禁入日志。

## 语音

SpeechController导出由frontend/src/speech/controller.ts实现，类型shared/r2.ts。沿用现有SpeechAdapter和后端语音路由。enable由明确用户动作调用；capabilities真实，未实现pause/resume返回not_implemented。
begin(SpeechRun)建立request/session/campus/generation快照；append(generation_id,text)仅收A认可的可见正文；finish(generation_id,final_text)校验最终正文、排队剩余段并等待本轮队列终止，不重复播放已读前缀。
B唯一实现跨chunk净化器与串行队列：跨chunk URL、Markdown链接、引用标记、反引号状态不能被切断绕过；保留可读链接标签，去URL/格式控制符，逐句封口，单段1–4000。队列容量最多64段/23000字，溢出必须可见错误和停止，不能丢字假完成。
自动brief为最多前两句/220字的短播（标“短播”，不是额外模型总结）；full为全文。选段/playSegment与playFull共用净化及FIFO；不得并发多个音频。utterance_id和segment_id每段唯一，generation_id每次播放新建。旧回调不更新新generation。
A读取当前开启偏好，收到正文后立即append，不等待completed后假装增量；B实际onplaying才发speaking，onended发结束，play Promise拒绝发error。缺口型时间戳capability=none，不宣称专业口型。
“停止回答”=A请求取消+停止本轮语音；“停止播报”=只B.stop，不取消模型。新发言/清空/切校区统一先失效旧generation再停止。B负责释放VAD/音频/BlobURL；同一语音stop不重复发两次。

## 知识、点位、地图和图片

D 继续 data/knowledge 的独立资料和内存检索，允许向原JSON规范化扩展，不新建第二点位库。
|模块方法/HTTP|参数|响应|
|---|---|---|
|search / GET /knowledge/search|query1–500,campus_id,limit1–20默认5|原SearchResponse，空hits=[]、真实status|
|get_status / GET /knowledge/status|无|原KnowledgeStatus|
|list_buildings/get_building / 旧buildings端点|校区/实体ID|POI兼容投影，未知404|
|list_pois / GET /knowledge/pois|campus_id必填；category枚举可空；query0–100；limit1–100默认20；cursor可空0–256|POIPage items/total/next_cursor/version；空目录items=[] total=0 next_cursor=null|
|get_poi / GET /knowledge/pois/{id}|稳定ID|POI；未知404|
|get_coverage / GET /knowledge/coverage|无|Coverage；原子事实未知填null，不用摘要数顶替|
|get_campus_assets / GET /knowledge/campus-assets|campus_id|CampusAssets maps/media/version；真实空数组|

上述方法定义在backend/knowledge/service.py的knowledge对象。M0 routes为501，D必须补服务方法并改路由使用同一store。目录分页与检索top5独立；cursor绑定版本及过滤条件，篡改/过期400，不能将下一页内容重复算实体。
KnowledgeRecord包括id/campus/entity/title/category/aliases/fact/sources/applicable_at/retrieved_at/verification_status；原子事实、页面、chunk独立计数。获取日期不是事实更新日期。Source保留ID/标题/片段/URL/校区/发布日期nullable/获取日期。
POI含id/campus/name/aliases/category/description/source_refs/location/entrances/verification_status及schematic_position；source_refs引用资料ID。8目标类别和other见共享枚举。
GeoLocation lng/lat/crs(WGS84|GCJ02)/coordinate_source/verified_at/quality(entrance|building_center|approximate|pending)，不可核验为null。已有原始坐标不覆盖，在线投影只在A渲染层一次转换并保留来源/CRS；不将图面坐标转换成假经纬度。
schematic_position=(map_id,x,y,source_ref,quality)，x/y是0–1图面相对值，原点左上；永远不作为导航坐标。CampusMap含作者/使用依据/资料年代/版本，kind=schematic|licensed_map；supports_precise_navigation=false。本地图可自行绘制有依据的抽象示意，不偷用未经授权的学校地图图片。
CampusMedia要求实际照片，字段见schema；本地path固定 /assets/campus/...，图面及图片清单由D、渲染由A；focal_point0–1；未确认使用依据只进data候选清单，不进可显示media。保留作者和来源链接。
ProviderCrosswalk只作独立实体与厂商ID匹配，记录验证/留存依据；厂商结果和独立资料分计，未核验许可不持久镜像地图瓦片/厂商POI。门禁/校门/道路访问依据记entrances.access_notes与source_refs；路线返回不自动证明通行。

## 无Key基础 + 有Key增强

|端点/模块|契约|M0状态|
|---|---|---|
|GET /api/maps/status|MapStatus，各能力单列；配置存在≠验证成功|真实布尔，功能not_implemented|
|GET /api/maps/config|仅js_key可公开；service_host固定/api/maps/amap/_AMapService|没有security/web服务秘密|
|GET /api/maps/external-navigation/{poi_id}|ExternalNavigation url/kind/precision|501；C补链接，A保留入口|
|GET /api/maps/amap/_AMapService/{path}|高德官方serviceHost薄代理|501；C实现固定host/path/query allowlist|
|POST /api/maps/routes|RouteRequest→RouteResponse|缺Web服务key503/map_not_configured；有key未实现501|
|POST /api/maps/routes/{route_id}/cancel|session_id→RouteCancelResponse|501；C校验归属/关闭本地连接|

A 本地图和知识目录不依赖在线config请求完成；缺Key清晰显示在线NOT_CONFIGURED，不阻塞聊天/生成/语音。
A 在可用且用户点击“开启定位”后加载 AMap.Geolocation，授权前不定位，拒绝/失败保留基础图与外链；停止定位清watch与事件。IP级结果不能标精确定位，展示来源、精度、时间；用户位置只存内存，不进入会话、LLM、导出或运行日志。
在线路线选定Web服务步行接口，由C经现有httpx调用。只有用户点击“去这里”/明确导航动作时，A拿有效授权位置、已核验目标ID（可选entrance_id）发RouteRequest；精确坐标仅作为必要路线参数发给同源C并转高德。输入固定GCJ02，拒绝混系，未来其他来源需先由M扩展。
同route_id重复409；A禁用运行中按钮并防抖500ms；C每session最多1个规划、6次/分钟，全应用30次/分钟/最多2个规划并发，限频429携带Retry-After。计数表容量1000、TTL60秒。只记次数/状态，不记录位置。完成/取消释放当前坐标；未核验存储条款前不缓存厂商结果。
定位更新只移动标记，不自动规划。未授权、无Key、无有效目标坐标、超限、服务错误都保留目标信息和外部导航入口；外链只用已核验坐标，或清晰标记“按名称搜索”，不把示意点当目的坐标。外链固定高德HTTPS白名单、URL编码名称，不能任意javascriptURL。
RouteResponse只表示地图提供方方案，campus_access默认unverified；D有可追溯当前入口/门禁/道路依据才verified。路线取消是独立route_id生命周期，不污染LLM request日志。
A在加载SDK前将window._AMapSecurityConfig.serviceHost设置为location.origin + config.service_host（绝对同源URL），不设置浏览器securityJsCode。
安全代理仅转发实现所必需的官方固定路径/字段；剥离客户端key/jscode/任意目标URL，不跟随到其他host，不代理内网。来源限制/localhost要求见本机配置指南。高德安全密钥与Web服务Key只留后端root.env。

参考官方已读文档：[安全代理](https://lbs.amap.com/api/javascript-api-v2/guide/abc/jscode)、[定位插件](https://lbs.amap.com/api/javascript-api-v2/guide/services/geolocation)、[步行路线](https://lbs.amap.com/api/webservice/guide/api/direction)、[外部单点入口](https://lbs.amap.com/api/uri-api/guide/mobile-web/point)。文档仅证明厂商接口，不证明校园通行。M1分别实测本地图、外链、在线底图、定位、规划及通行依据。
