# M1-R2 返修台账（M 独占）
审查基线：M 950d0b8；A cee0c63、B 08ede98、C 4eb836c、D 41a95f0。用户已确认四窗口完成；工作树干净，B/D 明确停写，A/C 以用户停写授权及稳定提交核对。以下为独立审查，不是窗口自评。

|编号|级别/责任|复现与实际（审查文件）|期望/最小范围与通过标准|状态|
|---|---|---|---|---|
|A01|P0 A|CampusExplorer切A点→B点，旧externalNav仍显示且未绑定poi_id|切点同步失效外链/路线；延迟响应与快速切点测试不得把B导航至A|OPEN|
|A02|P1 A|App fetch等headers无deadline；await speech.finish阻塞生成rendered/loading；失败不停止声音|请求截止覆盖headers/body；文字终态独立于音频；错误/清空/校区停止旧音频；慢headers、被阻播放、断流回归|OPEN|
|A03|P1 A|r2-model completed后delta仍修改正文；完成来源合并retrieved|终态后不可变、最终正文/来源权威覆盖；同chunk completed→late测试|OPEN|
|A04|P1 A|CampusExplorer本地数据等待地图配置；VERIFIED才能首次规划；REST主路；切校区routeBusy不释放|本地独立加载；装配M JS导航预算/manual/路线上述；更换目标/校区失效旧路线和busy，外链常驻|OPEN|
|A05|P1 A|App独立ASR adapter；无恢复/声线入口；生成展开转chat却无原稿历史|使用B getAdapter半双工；点击恢复/音色/继续讲；生成追问保持原生成上下文；生命周期隔离测试|OPEN|
|A06|P2 A|CampusBackdrop切换assets null立即卸旧背景|新图成功才过渡，失败不白闪；真实照片缺失另列|OPEN|
|B01|P1 B|Markdown ]与(分chunk且标签含句号时漏字；take重写已发前缀|所有切点净化一致、不可变已读前缀、URL不漏读；controller最小修复|OPEN|
|B02|P1 B|旧playPreparedSpeech延迟failed把新request speaking置error|每个await后校验代与item；adapter旧play catch不能清新player回调；竞态回归|OPEN|
|B03|P1 B|stop(campus_change)后continueRemaining播放旧校区|clear/new_request/cancel/campus_change清lastResponse/lastPlayback；user停止按明确策略|OPEN|
|B04|P1 B|六短句合并一段后brief全读|先按句数/220字裁定最多两句，再合段；六短句/超长首句回归|OPEN|
|B05|P1 B|voices客户端4s<后端10s；voiceschanged仅1.2s|合理超时/显式刷新重试；>4s成功、延迟voiceschanged、失败后重试|OPEN|
|C01|P0 C|provider.stream finish允许None，收到正文后自然EOF可completed|只接受真实stop结束，缺finish/断流且已有正文INCOMPLETE_OUTPUT partial；timeout/disconnect/length原因准确；忽略reasoning且拒绝未执行tools；隔离SSE故障测试|OPEN|
|C02|P1 C|/chat拒绝所有content_generation，只有SSE才能生成|兼容接收完整R2请求实现真实非流式生成，与流共用provider/history/runtime；旧聊天兼容，缺generation明确422；三类型非空及错误回归|OPEN|
|C03|P1 C|maps/status知识ready即local_map ready；JS代理无Walking路径，HTTP200业务失败也VERIFIED；REST状态与JS主线不符|真实地图资产状态、JS主路线配置、官方固定路径安全代理/参数限制/分类计数；业务失败不可VERIFIED；名称外链含校区，manual合法但不冒充GPS；0配额隔离测试|OPEN|
|D01|P1 D|92POI只有1个兼容get_building；三问桥search空；郑东馆目录无|同事实/POI源旧新投影；所有稳定实体可被C校验；补郑东旧ID，修全校三馆事实，精确目录优先|OPEN|
|D02|P1 D|中文query返回291字符cursor下一页422；checksum正确payload=[]导致500|cursor短摘要≤256、严格类型/offset；长中文分页完整、任意畸形400|OPEN|
|D03|P1 D|coverage硬编码source_pages=6，复合摘要+名称冒充99原子；坐标只判quality|实际事实记录/来源去重/证据计数；不凑数，未拆前fact_count=null；增加可核验事实至可达范围|OPEN|
|D04|P1 D|maps=[]、全部schematic_position=null；40+10题不存在|官方地图位置依据自绘抽象图与标注（非经纬度）；冻结40证据+10未知/歧义及离线Recall评测，真实缺口披露|OPEN|
|D05|P1 D|importer只计长度，孤儿引用不拒绝，替换中途可半套语料|模型/ID/来源校验；完整事务/回滚保留备份；非法输入/中断隔离测试|OPEN|
|M01|P1 M|合法.worktrees开发路径被Vite deny误拦；manual来源与B控制API缺类型|只允许当前frontend/shared且禁.env/嵌套其他树；共享类型、schema、导航预算协调|IN_PROGRESS|

外部/证据缺口：ASR独立服务未配置；真实麦克风与人耳听音未验证；高德凭据类型未确认、未写入；坐标与现场门禁、照片使用依据不以假数据补齐。它们不阻止上述代码返修。每窗仅更新自己的 docs/handoffs/R2_X.md，引用编号、提交、命令及结果，然后停止写入。共享台账只能M更新。
