# R2 原子验收矩阵

状态不是窗口自报结论。M0仅记录基线；M1对每行填PASS/FAIL/BLOCKED/NOT_IMPLEMENTED/NOT_TESTED，附提交和证据，审计PARTIAL需拆分到原子项。完成度=PASS条数/固定全部条数；另算必须项PASS率、P0失败数，不能用平均分覆盖硬阻断。可选在线缺Key标NOT_CONFIGURED单列，不能阻塞其他链路。M不能因为实现困难删除条目。

|ID|级别|负责人|目标|测试/证据要求|M0状态|当前依据|
|---|---|---|---|---|---|---|
|G01|P0|C|三类生成guide_script/visit_plan/social_post各真实非空并正确glm|同request_id输入→模式→模型→终态，模型/usage/耗时，无隐藏推理|FAIL|baseline-api普通生成model_mismatch；三类尚未实现|
|G02|P0|A/C|完整生成实际可读渲染|三类型浏览器截图+generation.completed与frontend generation.rendered配对|NOT_IMPLEMENTED|独立结果区与回执stub|
|G03|P0|C|失败/空/超时/截断明确终态|隔离边界测试+真实错误记录；INCOMPLETE_OUTPUT partial=true|NOT_IMPLEMENTED|当前未检查finish_reason|
|G04|P0|A/C|聊天与生成独立state/取消/结果|并发按钮复現步骤，不共用loading|NOT_IMPLEMENTED|当前共用|
|L01|P0|C|指定GLM真实一问一追问|正确模型、可复述临时标记、usage或null；合并后重新调用|PARTIAL|M1通过，本轮单问通过但生成失败|
|L02|必须|C|上游到页面真实增量|首正文/全文时间；不计reasoning/心跳；UTF8跨chunk|PARTIAL|仅上游探针首正文19797ms|
|L03|必须|A/B/C|全文前第一句真实播出|首正文/首可听/全文时间，同request与generation|NOT_IMPLEMENTED|无页面流/队列|
|L04|P0|C|accepted和started在结束前可见|慢请求进行时日志截图/脱敏事件|PARTIAL|API可见，浏览器待验|
|L05|必须|C|终态一次/重复ID409/断连取消|隔离stop/length/EOF/空/重复case，不改变正常online状态|NOT_IMPLEMENTED|R2实现待补|
|S01|P0|B/A|明确开启后连续5回答自动可听|真实浏览器与提供方、每次音频实际播放开始/结束|NOT_TESTED|缺浏览器现场|
|S02|必须|B|跨chunk URL/Markdown净化|URL拆chunk和链接标签测试+听音；正文来源保留|NOT_IMPLEMENTED|原文直接TTS|
|S03|必须|B/A|短播/全文/选段同一串行队列|长文>4000真实分段，无重叠/不丢字/不重复|NOT_IMPLEMENTED|只有整条|
|S04|P0|B/A|音频独立停止；回答取消清队列|播放中停止/新发言/清空/切校区实测和事件|NOT_IMPLEMENTED|stop共用且重复|
|S05|必须|B|音色载入/失败重试/中文音色选择|网络慢4秒以上、voiceschanged延迟、真实播报|NOT_IMPLEMENTED|前后超时不一致|
|S06|必须|B|中文ASR/麦权限/停止capture|真实麦授权拒绝/允许及一次final后资源停止|BLOCKED|ASR服务未配置；不得拿chat当ASR|
|S07|必须|B|人物状态来自音频，保留kelaita|实际页面+onplaying/ended/cancel，lip能力诚实|NOT_TESTED|素材在项目，页面待验|
|D01|必须|D|>=80去重独立POI、每校区>=30|ID/别名去重清单、校区分类统计|FAIL|2/80，卫津0北洋2|
|D02|必须|D|8类实际点位覆盖|teaching/library/gate/dining/dorm_area/sports/culture/service统计|FAIL|覆盖不足|
|D03|必须|D|>=80% sourced/map_checked地理坐标|原始CRS/来源/核验日、入口/中心/近似分别数|FAIL|0/2；无Key不妨碍资料建设，不编造|
|D04|必须|M/D|每校区10点独立抽查|主控抽样坐标/校区/入口证据，地图对照|NOT_TESTED|不能只抄D PASS|
|D05|必须|D|>=200不同原子事实|页面/事实/chunk分别计数，日期/出处/冲突台账|FAIL|7摘要，原子事实数未知|
|D06|必须|D/M|40有证据题+10无证据歧义题|每校区20，人工相关来源，Recall@5>=85%|NOT_IMPLEMENTED|冻结题集后主控复算|
|D07|必须|D/A|过滤/分页目录完整总数|分页去重并集=真实total，campus/category/query，top5独立|NOT_IMPLEMENTED|新接口501|
|D08|必须|D/A|每校区>=2可用真实照片|作者/原链接/使用依据/实际校区逐张核验|FAIL|0张校园照片|
|D09|P0|D/C|无资料不编造/实体校区校验|未知/歧义/跨校区ID；来源可回查|PARTIAL|旧接口部分测试，新POI待测|
|M01|必须|A/D|无Key双校区本地图交互|断开在线服务仍缩放/点选/检索/卡片/场景回执可用|NOT_IMPLEMENTED|图面和代码stub|
|M02|必须|A/C|保留外部导航入口|真实浏览器链接打开；坐标或名称搜索准确标注|NOT_IMPLEMENTED|独立于在线Key验收|
|M03|可选在线|A/C|高德在线底图/安全代理|真实配置布尔、网络与浏览器；秘密不进网页|NOT_CONFIGURED|提供配置类型待确认|
|M04|可选在线|A|授权后定位插件，可停止|授权前0定位；拒绝/允许/停止/精度/时效实测|NOT_IMPLEMENTED|不声称精准定位已完成|
|M05|可选在线|A/C|按需路线规划与配额保护|问答/位置更新0自动路线；点击1次、连续点击去重、429外链|NOT_IMPLEMENTED|缺配置继续基础导览|
|M06|必须真实性|D/M|路线与实际通行核验分开|入口/门禁/道路来源；未核验campus_access=unverified|NOT_TESTED|高德路线不替代校园证据|
|M07|P0|A/C|位置隐私及地图异常降级|LLM/日志/导出无精确位置；无Key/超限仍可聊天生成|NOT_IMPLEMENTED|新接口未调用上游|
|X01|P0|A/B/C|快速发言/取消/清空无迟到污染|进行中模型/TTS/音频各时点复现，generation guards|NOT_IMPLEMENTED|原校区切换缺取消|
|X02|P0|A/B/C|切校区隔离上下文、图、背景、语音|原历史可追溯，当前校区无旧“这里”|FAIL|静态已确认缺guard|
|X03|必须|A|桌面/小屏/中文IME/空和错误态|实际渲染截图、输入与可访问交互|NOT_TESTED|BROWSER_QA_PENDING|
|X04|P0|M|合并后密钥/私密资料零泄露|跟踪/历史/构建/导出只报位置数量|NOT_TESTED|M0提交前扫描；M1必须重扫|
|X05|必须|M|保持原路线、人物、许可与正常功能|原框架依赖/复用路径、锁构建、资产相对URL|PARTIAL|组件路线保持，R2新增两依赖|
|X06|必须|M|独立评审并返修后复验|各窗逐项得分/质量/证据缺口/具体返修单|NOT_TESTED|M1工作，不可自删难项|

M1输出 docs/R2/REVIEW.md、各窗口返修单及复验记录、统一 FINAL_REPORT.md；API通过不代替浏览器。无浏览器权限保留最短手测步骤且不能伪造截图。完整比赛要求继续见docs/NEXT_PHASE.md，不因为R2部分通过宣称比赛验收通过。

导航增补原子项（保留原矩阵）：Q01四类分别计数；Q02前端业务发起/代理HTTP/控制台扣减分源；Q03默认1/1/0/1预算和刷新保持；Q04失败取消不退预算/无自动重试；Q05控制台实际配额与QPS核对；Q06JS Key不得用于REST、security只在服务端；Q07真实路线步骤接B现有controller、外部导航保留。Q01/Q03/Q04已有隔离测试；其余必须现场或代码联调复核，不能以fixture标真实PASS。

M1说明：上表保留M0冻结要求与当时状态；当前实现结论见FINAL_REPORT，填写后的量化评分与测试明细按用户要求仅保存在本机.runtime/M1-R2/assessment，不上传仓库。
