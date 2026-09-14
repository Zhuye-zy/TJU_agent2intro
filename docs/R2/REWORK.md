# M1-R2 返修台账（M 独占）
审查基线：M 950d0b8；A cee0c63、B 08ede98、C 4eb836c、D 41a95f0。用户已确认四窗口完成；工作树干净，B/D 明确停写，A/C 以用户停写授权及稳定提交核对。以下为独立审查，不是窗口自评。

|编号|级别/责任|复现与实际（审查文件）|期望/最小范围与通过标准|状态|
|---|---|---|---|---|
|A01|P0 A|CampusExplorer切A点→B点，旧externalNav仍显示且未绑定poi_id|切点同步失效外链/路线；延迟响应与快速切点测试不得把B导航至A|实现返修已复验 442e32d；真人/外部项见矩阵|
|A02|P1 A|App fetch等headers无deadline；await speech.finish阻塞生成rendered/loading；失败不停止声音|请求截止覆盖headers/body；文字终态独立于音频；错误/清空/校区停止旧音频；慢headers、被阻播放、断流回归|实现返修已复验 442e32d；真人/外部项见矩阵|
|A03|P1 A|r2-model completed后delta仍修改正文；完成来源合并retrieved|终态后不可变、最终正文/来源权威覆盖；同chunk completed→late测试|实现返修已复验 442e32d；真人/外部项见矩阵|
|A04|P1 A|CampusExplorer本地数据等待地图配置；VERIFIED才能首次规划；REST主路；切校区routeBusy不释放|本地独立加载；装配M JS导航预算/manual/路线上述；更换目标/校区失效旧路线和busy，外链常驻|实现返修已复验 442e32d；真人/外部项见矩阵|
|A05|P1 A|App独立ASR adapter；无恢复/声线入口；生成展开转chat却无原稿历史|使用B getAdapter半双工；点击恢复/音色/继续讲；生成追问保持原生成上下文；生命周期隔离测试|实现返修已复验 442e32d；真人/外部项见矩阵|
|A06|P2 A|CampusBackdrop切换assets null立即卸旧背景|新图成功才过渡，失败不白闪；真实照片缺失另列|实现返修已复验 442e32d；真人/外部项见矩阵|
|B01|P1 B|Markdown ]与(分chunk且标签含句号时漏字；take重写已发前缀|所有切点净化一致、不可变已读前缀、URL不漏读；controller最小修复|实现返修已复验 82ccf59；真人/外部项见矩阵|
|B02|P1 B|旧playPreparedSpeech延迟failed把新request speaking置error|每个await后校验代与item；adapter旧play catch不能清新player回调；竞态回归|实现返修已复验 82ccf59；真人/外部项见矩阵|
|B03|P1 B|stop(campus_change)后continueRemaining播放旧校区|clear/new_request/cancel/campus_change清lastResponse/lastPlayback；user停止按明确策略|实现返修已复验 82ccf59；真人/外部项见矩阵|
|B04|P1 B|六短句合并一段后brief全读|先按句数/220字裁定最多两句，再合段；六短句/超长首句回归|实现返修已复验 82ccf59；真人/外部项见矩阵|
|B05|P1 B|voices客户端4s<后端10s；voiceschanged仅1.2s|合理超时/显式刷新重试；>4s成功、延迟voiceschanged、失败后重试|实现返修已复验 82ccf59；真人/外部项见矩阵|
|C01|P0 C|provider.stream finish允许None，收到正文后自然EOF可completed|只接受真实stop结束，缺finish/断流且已有正文INCOMPLETE_OUTPUT partial；timeout/disconnect/length原因准确；忽略reasoning且拒绝未执行tools；隔离SSE故障测试|实现返修已复验 ac74a29；真人/外部项见矩阵|
|C02|P1 C|/chat拒绝所有content_generation，只有SSE才能生成|兼容接收完整R2请求实现真实非流式生成，与流共用provider/history/runtime；旧聊天兼容，缺generation明确422；三类型非空及错误回归|实现返修已复验 ac74a29；真人/外部项见矩阵|
|C03|P1 C|maps/status知识ready即local_map ready；JS代理无Walking路径，HTTP200业务失败也VERIFIED；REST状态与JS主线不符|真实地图资产状态、JS主路线配置、官方固定路径安全代理/参数限制/分类计数；业务失败不可VERIFIED；名称外链含校区，manual合法但不冒充GPS；0配额隔离测试|实现返修已复验 ac74a29；真人/外部项见矩阵|
|D01|P1 D|92POI只有1个兼容get_building；三问桥search空；郑东馆目录无|同事实/POI源旧新投影；所有稳定实体可被C校验；补郑东旧ID，修全校三馆事实，精确目录优先|实现返修已复验 82e8794/fc83625；真人/外部项见矩阵|
|D02|P1 D|中文query返回291字符cursor下一页422；checksum正确payload=[]导致500|cursor短摘要≤256、严格类型/offset；长中文分页完整、任意畸形400|实现返修已复验 82e8794/fc83625；真人/外部项见矩阵|
|D03|P1 D|coverage硬编码source_pages=6，复合摘要+名称冒充99原子；坐标只判quality|实际事实记录/来源去重/证据计数；不凑数，未拆前fact_count=null；增加可核验事实至可达范围|实现返修已复验 82e8794/fc83625；真人/外部项见矩阵|
|D04|P1 D|maps=[]、全部schematic_position=null；40+10题不存在|官方地图位置依据自绘抽象图与标注（非经纬度）；冻结40证据+10未知/歧义及离线Recall评测，真实缺口披露|实现返修已复验 82e8794/fc83625；真人/外部项见矩阵|
|D05|P1 D|importer只计长度，孤儿引用不拒绝，替换中途可半套语料|模型/ID/来源校验；完整事务/回滚保留备份；非法输入/中断隔离测试|实现返修已复验 82e8794/fc83625；真人/外部项见矩阵|
|M01|P1 M|合法.worktrees开发路径被Vite deny误拦；manual来源与B控制API缺类型|只允许当前frontend/shared且禁.env/嵌套其他树；共享类型、schema、导航预算协调|共享实现通过：Vite 200/403、14导航+2 JSON测试、导出构建|

外部/证据缺口：ASR独立服务未配置；真实麦克风与人耳听音未验证；高德凭据类型未确认、未写入；坐标与现场门禁、照片使用依据不以假数据补齐。它们不阻止上述代码返修。每窗仅更新自己的 docs/handoffs/R2_X.md，引用编号、提交、命令及结果，然后停止写入。共享台账只能M更新。

## 集成后新增返修
|编号|级别/责任|复现/根因/证据|最小修改与通过标准|复验|
|---|---|---|---|---|
|C04|P1 C|真实visit_plan HTTP200但正文拒答无来源（初次证据5341aa27/3c7ee718）；普通检索无命中，已有目录实体未进入生成上下文|仅model/service.py；visit_plan回退本校区真实目录、受限上下文，不造坐标；真实POST/SSE均须返回有来源可读计划|91f9ab5；主控bd175b62/23e43c59均返回带实际来源的可读计划，关闭实现问题|
|B06|P1 B|主控直接adapter.test读取旧.runtime构建产物导致挂起；不是业务播放证据|测试入口自行构建独立产物、计时退出；直接运行不依赖旧缓存|610cfc0，主目录21语音测试通过，关闭|
|M02|P1 M|JSON错误响应/headers无完整时限，可能保持UI等待|transport/api.ts覆盖headers+JSON；坏JSON安全错误、不输出HTML；15秒/长chat125秒|a56785c，2隔离测试通过，关闭|
|M03|P1 M|Vite缺失.env路径会返回SPA200，易误导安全审计|配置中显式拒绝私密URL，保留当前frontend/shared可读|实际5183 .env/.runtime及其他树403，源码200，关闭|

返修窗口均已提交并停止，主控独立复验。没有修改共享台账来替代功能。D的地图曾因主控误读忽略目录旧生成器被怀疑坐标归一化错误；复读实际提交SVG确认已有正确缩放，撤回该误报，不留下虚假未关闭项。

仍开放验收：真实UI/声音/IME/五次自动播报；ASR外部服务；地图Key类型/真实坐标/现场通行；4张可用照片。这些不能用隔离测试或降要求关闭。
