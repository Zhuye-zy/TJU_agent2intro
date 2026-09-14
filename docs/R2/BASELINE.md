# R2 当前基线审计

审计日期：2026-09-14。产品为珂莱塔校园导游。本轮仅做 M0 准备，业务故障仍待 A/B/C/D 修复。
优化前真实基线：`48ebbd116974b73384ebea7dd73c1a6ed5e5c9e0`，原集成分支 `integration/m0`。D→C→B→A 已在 M1 合并，四分支提交均在当前历史中；开始时五个目录干净。原工作树和分支继续使用，无 reset/clean/stash。
临时建过 integration/r2，未产生新提交，按用户要求停用并保留。R2 变更继续推送原分支。

## 运行与内容生成

主应用 http://127.0.0.1:8000 在线；基线监听 PID 10608。模型 configured=true / M1 verified=true，ASR=false，M1 TTS MP3 已生成；这些不等于当前浏览器全流程通过。
本轮脱敏原始元数据：[baseline-api.json](evidence/baseline-api.json)。

|实测|结果|最窄已确认边界|
|---|---|---|
|content_generation：“请为这里写一段80字迎新导游词，不编造建筑事实。”|HTTP 200，local-workflow，30 字，312ms；没有模型调用|model/service.py 的 _HERE_RE/意图门控作用于生成模式，提前返回选择建筑提示|
|content_generation：80字天津大学迎新欢迎词，无未核验时间地点网址|HTTP 503，model_mismatch，11,781ms，正文0|请求已进入模型，provider 的 completion.model 与指定模型精确匹配检查拒绝；原日志未保存实际返回 model，因此具体差异待 C 诊断，禁止直接绕过校验|
|general_chat 中文打招呼|HTTP 200，glm-5.1，38字，14,906ms；usage 350/741/1091|本轮普通聊天成功，不能替代内容生成验收|
|直接上游 stream=True 探针|glm-5.1，48字，finish_reason=stop，首正文19,797ms、全文20,172ms|上游本次真流可用；应用仍 stream=False，没有页面增量或首播证据|
|请求开始日志|三个请求都可取到 started|日志轮询独立于正文，不是正文流式；极快本地返回不用于声称“仍 pending”|
|流客户端关闭|退出时 httpcore2 异步生成器关闭警告|不影响已收正文，但 C 必须检查连接关闭/取消，不隐去资源清理风险|

UI 静态路径：frontend/src/ui/App.tsx 的模式按钮→同一输入框/sendMessage→transport.chat→POST /api/chat→model/routes.py→service.generate→provider.complete→完整 JSON→messages 容器。
聊天和生成共用 busyRef/requestRef/controller/结果状态，尚无三类结构化生成表单和独立生成状态；C 全模式 URL/引用验证也需按事实问答与创作分别审查。
不声称复现了用户浏览器“无限转圈”的全过程：本轮 Computer Use 再次因无法可靠识别 Windows 当前浏览器 URL 被工具停止。未绕过，未生成截图。浏览器按钮、Network、渲染、音频权限仍 BROWSER_QA_PENDING。

## 数据逐层计数（只读审计）

|层|实际数量/状态|
|---|---|
|发现|第一轮 D handoff 实际读过7个URL；没有完整发现台账|
|采集|3个纳入使用的来源URL；未保存网页全文、地图或校园图片|
|提取|7条复合摘要：北洋园5、卫津路2；不是已证明的7个原子事实|
|去重|7个唯一记录ID和snippet，语义去重/原子事实数未知|
|存储/索引|JSON→内存7 documents、2 buildings；版本 sha256:e7d1329b9b4c|
|检索|校区内候选5/2，模型固定top5；独立API limit1–20|
|目录|北洋园2、卫津路0，无目录分页，也无隐藏显示上限|
|界面|默认卫津路0卡，切北洋园2卡；知识状态被取得但未渲染|
|坐标/地图/实景|2/2经纬度null；可用校园地图0、校园照片0；人物纹理不计校园照片|

证据：data/knowledge/{documents,buildings}.json、SOURCES.md、backend/knowledge/service.py:67,121,149，routes.py:10；frontend/src/ui/App.tsx:68,90,226；docs/handoffs/D.md。
2017校园地图仅历史资料摘要，没有可再发布的地图资产。保留 JSON 存储，D 扩展实体与台账，不重建数据库或引入大型向量平台。

## 语音与上下文静态根因

- autoSpeak 默认关闭且持久化；等待期间开关被旧闭包捕获，完成时未读取当前偏好。
- 前端音色查询4秒，后端允许10秒；浏览器音色等1.2秒，没有重试；配置音色未用于选择。
- TTS直接读原始Markdown/URL；只有当前整条回答，净化/分句前4000字硬拒绝；没有FIFO增量队列。
- 停止回答/识别/播报混用，重复发speech stop；纯音频停止会取消文字任务。
- 切校区只重新加载建筑，不使旧请求失效；旧回复、动作、语音可进入新校区状态。
- Audio.play Promise、onplaying/ended 是真实回调；没有AudioContext/RMS；人物lip_sync=none。音频一次性URL在浏览器Range/重复GET时风险待实测。
- VAD final后未自动停止采集，需要 B 验证并修复。
证据：App.tsx:84–101,141–200,210–214,226；speech/adapter.ts:155,197–278,373–431,500；speech/service.py:103,235–267；avatar/adapter.ts:190。
隔离FakeAudio测试不能证明实际中文可听、麦克风和5次自动播报通过。

## 本轮地图决定

无Key基础导览（A本地图交互、D图面及标注），有Key在线增强（C服务适配、A高德JS）。
独立验收本地图、外部导航、在线底图、授权定位、按需路线、校园实际通行核验。
用户授权定位后才调用 AMap.Geolocation；用户点击“去这里”或明确导航时才规划，不因每次问答/定位更新重复请求。
没有Key不阻塞聊天、生成、语音、知识。本轮基线以上地图能力均未实现；不能把示意图点位当精确经纬度。
