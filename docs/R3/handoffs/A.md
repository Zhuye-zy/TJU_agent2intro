# R3 A 前端交接

## 状态与基线

- 整体 **PARTIAL**：A 可独立开发部分已提交，真实流程与共享接口缺口待集成。
- 工作树：E:\AI4TJU\.worktrees\ui；分支 work/ui。
- BASE_COMMIT_R3：0bf2e4bc8f49a9697878eaf0db614a1017ace5c1。
- 开发前核对 HEAD = r3-launch = BASE_COMMIT_R3，主目录回执 R3_READY，原工作树干净。
- 已同步 COORD_COMMIT：无新增公布号，没有拉取其他窗口业务分支。
- 协调请求提交：2c6cc23。
- 功能提交：8649929e7226cd75750d883365db938dbd3ec2e1。
- 最终交接提交：包含本文的提交，以 git log -1 --format=%H -- docs/R3/handoffs/A.md 查询；对外回报完整 SHA。
- **已停止修改：是。** 本交接提交后停止修改，等待 M 评审。

## 改动

仅修改 A 授权路径，未修改 shared、transport、后端、依赖、锁或 D 素材。

|文件|内容|
|---|---|
|frontend/src/ui/TourWorkspace.tsx|时长/兴趣/起终点/必去避开/无台阶输入；校区快照；结构化地点卡；已有命令、剩余时间、删除和替换；保存恢复|
|frontend/src/ui/tour-model.ts|C 快照展示、请求代次与双版本守卫、白名单存储、自由文本位置移除、B 事件上下文检查|
|frontend/src/ui/App.tsx|默认行程入口与旧视图切换、按校区内存快照；确认/自动发送；插话取消行程和模型任务；技术详情与人物适配器|
|frontend/src/ui/CampusExplorer.tsx、frontend/src/scene/amap.ts|通过 navigateTourStop 进入既有 AmapNavigation；开始/继续/下一站导航；底部步骤、手动偏航重算、定位和轨迹释放|
|frontend/src/ui/map-session.ts|同一天保留 M MapBudget 实例，维持单并发、5 秒间隔、每分钟限频与持久每日预算|
|frontend/src/ui/tour.css|390px 响应式、时间轴、底部导览、语音与讲解入口、键盘焦点和减少动态效果|
|tests/ui/tour.test.mjs|10 项新增隔离测试，包含 M HTTP fixture 主流程|

实际复用 r3Transport、acceptsTourResult、navigateTourStop/AmapNavigation、r2Transport、B SpeechController 和 AvatarAdapter。C 的 TourSession 是唯一行程权威；A 不计算站点选择或顺序、不新建模型历史。409 后 GET 并提示用户重新确认，不自动重发修改。

B 新入口通过 Vite 可选 glob 装配 speech/interaction.ts。partial 只显示，final 由 A 决定提交，默认确认；上下文匹配 interaction/session/campus/generation/request。缺新入口时保留原 ASR 适配器，缺服务明确提示。所有朗读共用原串行队列，未直接操作 Cubism 或音频资源。可选电平回调仅转交 B 适配器。

## 数据边界

- 设备定位、当前路线、厂商目的地匹配与路线步骤仅用于导航；路线朗读沿原 B 播报入口，不送模型。
- 暂停、修订、取消和切校区清除定位/轨迹/标记；校区内存快照不含这些数据。
- 常见经纬度对及经纬度标签在发模型或保存前移除，提示使用地图定位入口；生成文本复制/导出也移除此类位置文本。C 仍须执行其边界检查，正则不是任意自然语言位置描述的完整识别器。
- 仅服务器 saved=true 后写 ai4tju.r3.saved-tour.v1.<session_id> 的白名单，UTF-8 最大 65536 字节；不存聊天、录音、设备坐标、polyline 或匹配结果。
- 未保存任务仅保留本页内存，刷新不恢复。已保存任务由用户点击恢复、交给 C 重验；不自动开启麦克风、定位或播放。
- 新建行程使用新 session_id，不静默删除其他已保存行程。forget 成功清除本机快照；可单独删除本机记录。
- IP 说明保留“区域中心/非设备实际位置”，到达只能手动确认。
- 没有读取根 .env，没有输出或提交秘密和真实位置。

## 验证（2026-09-15）

### PASS：构建与隔离回归

执行：

    npm.cmd run build
    node scripts/check-adapters.mjs
    node --test tests/ui/tour.test.mjs tests/ui/model.test.ts tests/ui/r2-model.test.ts tests/ui/navigation.test.ts tests/transport/r3.test.mjs tests/maps/navigation.test.mjs tests/speech/controller.test.mjs tests/speech/adapter.test.mjs
    git diff --cached --check

最终构建成功，**80 tests / 80 pass / 0 fail**。其中 A 新增 10 项，其余为原 UI、M 导航/transport 和 B adapter/controller 回归。这些结果不是浏览器或真实服务验收。

过程中缺少 adapter-build 时运行现有 check-adapters 解决；最终复跑曾因沙箱拒绝 Vite/测试缓存写入而 EPERM，按权限机制在授权环境重跑通过。未改依赖或跳过检查。

### FIXTURE_PASS：M HTTP 主线

测试确认 8011 空闲后，仅启动自己的 127.0.0.1:8011 fixture 子进程，结束仅关闭该子进程。逐次确认响应 X-R3-Fixture=TEST-ONLY。

实际执行：

1. 60 分钟输入，取得三个合成站点。
2. check → start → arrive → explain → complete_stop → next，到第二站。
3. pause → 改剩余 30 分钟 → 替换第三站 → 删除第三站 → resume；第一站完成记录不变。
4. save → 白名单存储模拟 → restore，返回 paused，第二站与已完成记录保留。
5. forget 清除记录 → cancel 终态。

另测迟到 create/GET、取消与跨校区/错请求拒收、双版本回退、损坏/禁止存储、坐标/未知字段过滤、语音上下文、视图切换保留地图限频。

M fixture 不是 C 幂等、合法转换、证据或路线可行性实现。fixture 替换没有验证新 stop_id 的 C 语义，不能据此宣称 T07/T11 真实通过。

### NOT_TESTED / BLOCKED

浏览器工具 cua.getState 返回 apps=[]、browsers=[]；尝试连接 127.0.0.1:5174 返回 **No browser is available**。未把静态构建和 HTTP 算作页面验收。

|矩阵|状态|
|---|---|
|T01/T04/T05/T06/T07/T08/T10|协议/部分纯逻辑 FIXTURE_PASS；真实页面与 C/live NOT_TESTED|
|T09/T12|隔离迟到拒收通过；真实 LLM/TTS/路线各时点取消 NOT_TESTED；上游不能假称已确认停止|
|T11|A 双版本守卫通过；C 幂等、提交原子性与合法转换待 C/M|
|T02/N02|UI 展示 unknown/warnings；真实依据和成本依赖 C/D|
|T03/N01|导航桥及预算代码接入、原 M 回归通过；实际定位和步行 NOT_TESTED|
|N03|投影/常见自由文本坐标测试通过；浏览器网络/存储/导出全链 NOT_TESTED|
|S01/S02/S03/S04|B 新模块、ASR、可听播放、嘴形及连续五轮联调 BLOCKED/NOT_TESTED|
|D03|消费同校区合法 CampusMedia；基线 usable_media=0，站点实景关联 BLOCKED|
|X01|390px 视觉、触屏、真实中文 IME、键盘和页面错误态 NOT_TESTED|
|X03|完整真实校园参观 NOT_TESTED，交由 M1|

## 接口问题和未完成项

开发早期已提交 [接口请求](../../requests/A/R3-interface-gaps.md)。

1. **跳过未实现**：TourCommand 无 skip。按钮明确“跳过本站（待接入）”并禁用，未将删除或完成冒充跳过。
2. **结构化澄清待接入**：TourResult 无 questions/clarification。目前只展示 C 错误说明和 warnings。
3. **必去/避开临时编码**：经 interests 中明确中文约束传给 C并保留快照；等待 M 正式字段，不能声称硬约束满足。
4. **照片按校区展示**：CampusMedia 缺 POI 关联；未猜地点，没有伪造图片。D 实景与使用依据待交付。
5. **语音待 B 联调**：新 interaction 入口未在本基线交付；自动发送目前走原校园问答，任意自然语言修改行程缺冻结路由。剩余时间/删除/替换走结构化按钮。
6. 浏览器/真机缺失；软键盘遮挡、人物实际尺寸、连续五轮插话、真实声音和步行均未测。
7. 保存丢包的同 request_id 幂等重放主要待 C/M；A 不自动重试 POST，冲突后重新读取并提示确认。

## M1 现场步骤

### 隔离页面

在 A 工作树确认端口空闲后，分别运行：

    .\scripts\Start-R3-Fixture.ps1 -Port 8011
    .\scripts\Start-Frontend.ps1 -Port 5174 -ApiPort 8011

打开 http://127.0.0.1:5174，必须看到“开发测试数据”。fixture 无真实地图和语音。浏览器设 390×844，另用真实手机触屏：

1. 中文 IME 填兴趣、必去/避开；选词 Enter 不提交。Tab/Shift+Tab/Enter 覆盖全部控件，焦点可见、无横向溢出。
2. 创建三站 → 检查 → 阅读条件并勾选 → 开始 → 手动到达 → 讲解 → 完成 → 下一站，检查第二站。
3. 暂停后缩短/替换/删除剩余站，完成站不变；继续不重复、不播放旧内容。跳过记录 BLOCKED。
4. 未保存刷新应无恢复；保存后刷新手动恢复为 paused；取消保存再刷新应无记录。
5. 切校区往返保留各自输入快照；新校区不显示旧地点/路线/字幕。延迟 create/revise/GET，取消或切校区后放行旧响应，不得覆盖。
6. 测试 501、409、404/过期、断网和存储拒绝/配额不足；失败修订不覆盖有效计划，错误入口可找到。
7. 软键盘、长中文正文、底部讲解展开时检查按钮与地图不被遮挡，审查人物真实尺寸。

### 真实集成

显式代理到 M/C 真实服务，不复制 .env。使用 D 核验的 3—5 站：

- 开始/继续/下一站检查 IP 粗略起点、同名目的地选择续跑、内部路线和外部导航。
- 暂停/修订/取消/切校区后位置与轨迹释放；预算不回退，偏航只在用户确认后重算。
- 网络面板确认设备坐标仅用于地图；存储/导出无坐标、轨迹、录音或识别正文。
- B 真实中文 ASR 先默认确认，再自动发送，连续五轮及插话；旧音频/回答不回流。分别记录 onplaying、听音、嘴形，音频 URL 不是播放成功。
- 执行到第二站并完成真实 3—5 站参观；入口、门禁、开放时间与通行按 D 依据和现场核验。
