# B-R2 交接：语音播放链与人物状态

日期：2026-09-14  
状态：**PARTIAL**。B 分配范围内的 SpeechController、播放校验、净化、队列和控制已实现并验证；主界面自动播报接线归 A/M，当前自动化环境也不能证明人耳实际听到声音，因此不把 S01/S07 写成完整通过。

## 基线、分支与提交

- 工作树：`E:\AI4TJU\.worktrees\avatar`
- 分支：`work/avatar`
- `BASE_COMMIT_R2`：`e272ed9b3eb31b57868f6e1077036a896750361f`
- 启动协调基线：`950d0b8ced1465e56343c212b24a97f23bdeb3bd`
- 实现提交：`104af5f`、`ef59003`
- 没有修改 desktop-pet、共享契约、入口、依赖、锁文件或人物框架；没有新增依赖。

## 实现结果

`frontend/src/speech/adapter.ts` 继续使用 Edge TTS、浏览器 SpeechSynthesis 降级、vad-web 和原 ASR 路由。服务器 TTS 不再把一次性 URL 直接塞给 `Audio`：现在先检查 TTS HTTP 状态与 JSON Content-Type，再取回同源音频，检查音频 HTTP 状态、`audio/*` Content-Type 和非空字节，用当前页面点击时创建并恢复的 AudioContext 解码，最后交给可复用 HTMLAudioElement。Blob URL 在结束、停止、取消、换代和 dispose 时释放。

`audio.play()` Promise、`playing`、`ended`、`error`、暂停、音量、静音和 AudioContext 状态均进入最多 256 条的内存 trace。trace 只含 request/utterance ID、阶段、状态码、类型、字节数、字符数和耗时，不含正文、URL、音频、录音、认证头或密钥。`speaking` 只由真实 `playing` 触发；TTS 请求开始和音频解码不会提前切 speaking。

`enable(true)` 必须由当前页面的用户点击或键盘动作调用。它创建复用播放器并恢复 AudioContext；持久化偏好本身不会激活新页面。若 `play()` 返回 `NotAllowedError`，当前 Blob、当前段和后续队列保留，进度返回 `playback_permission_denied`，再次点击开启/继续会重试当前音频。

`frontend/src/speech/controller.ts` 已实现冻结的 begin/append/finish/playFull/playSegment/stop/pause/resume/listVoices/subscribe/dispose，并提供具体类的 `replay()`、`continueRemaining()` 和受 `explicitRequest=true` 保护的 `playVerbatimUrl()`：

- 自动 `brief` 最多前两句、220 字，不在字中间截断；`full` 播全文；指定段、选中文字和全文走同一净化与 FIFO。
- 第一段完整封口后立即开始合成，不等待 completed。completed 只 flush 末段，并用最终全文校验已消费前缀，不从头重播。
- 最多 64 段、23,000 字、单段 4,000 字；短句适度合并。只串行播放，播放当前段时最多预取下一段。
- generation、request、segment 和内部 seq 共同标识段；A 先按 SSE event/seq 去重，B 保证同一队列项只合成一次。旧 generation 的 `ended/error` 不更新新人物状态。
- `playFull` 明确表示从头播。`continueRemaining` 只播最近一次自动短播尚未覆盖的后文。`replay` 从当前或最近一段开头重播。
- 普通入口始终过滤网址。只有 A 已确认用户明确要求逐字朗读网址时，才能调用单独的 `playVerbatimUrl(..., true)`；传 false 会返回 `explicit_url_request_required`。
- 停止播报只停止 B 的音频/合成/预取。`new_request`、`clear`、`campus_change`、`cancel` 会废弃队列、关闭请求、释放 Blob 并屏蔽旧回调；是否取消模型仍由 A/C 处理。
- HTMLAudio 的暂停/继续是真实当前位置恢复；Edge 服务器路径已在 Chrome 实测。浏览器 SpeechSynthesis 降级也调用其 pause/resume API，但本轮未在不同浏览器逐项验证精确恢复。

净化器跨 chunk 保存完整原文和已消费安全前缀，完整文本输出是最终一致性对照。Markdown 链接保留标题并去 URL；裸 URL、引用编号、图片、HTML、代码块和纯来源尾段被移除；列表转自然停顿；26 号楼、`2026-09-14`、`08:30` 和数量保持不变。未闭合 URL/链接/代码先缓冲，单个未闭合结构超过 4,096 字或总量超限会安全失败并保留页面文字。

同一个 `CampusSpeechController` 可通过 `getAdapter()` 给 A 用于 ASR。开始监听会先停止当前 TTS，采用半双工，避免持续自问自答；服务器 VAD 得到一次 final 或失败后会销毁采集。没有独立 ASR 配置时仍返回明确错误，不复用 GLM 地址。

## 当前音色和能力

真实 `GET /api/speech/voices` 返回 14 条中文 Edge 音色，791.7 ms：

- zh-CN：Xiaoxiao、Xiaoyi、Yunjian、Yunxi、Yunxia、Yunyang
- zh-CN 方言：liaoning-Xiaobei、shaanxi-Xiaoni
- zh-HK：HiuGaai、HiuMaan、WanLung
- zh-TW：HsiaoChen、HsiaoYu、YunJhe

默认验证音色为 `edge:zh-CN-XiaoxiaoNeural`。Edge 是联网服务。控制器 capabilities 为 incremental=true、pause=true、resume=true、timestamps=none。现有珂莱塔仍为 Live2D 2D，lip_sync=none；没有 viseme/音素时间戳，不声称准确中文口型。

## 实际验证

- `npm.cmd run build`：通过，132 modules transformed。
- `node --test tests/ui/model.test.ts tests/speech/adapter.test.mjs tests/speech/controller.test.mjs`：19/19 通过；新增控制器用例最终 10/10，通过跨 chunk 裸 URL/Markdown 链接/代码围栏、完整文本一致性、缓冲上限、首段提前播放、completed 不重播、5 次串行、短播/全文/选段/继续、暂停、重播、显式 URL 守卫、autoplay 恢复、切代和 TTS 重试。
- `.venv\Scripts\python.exe -m pytest -q`：35 passed，只有 Starlette 上游 anyio alias deprecation warning。
- 新 Chrome 会话没有使用 autoplay 绕过参数。点击前 begin 返回 `speech_not_enabled`；真实鼠标点击后 `enable=ready`、AudioContext=`running`。
- 同一新会话用 `zh-CN-XiaoxiaoNeural` 连续 5 次真实请求与浏览器媒体播放均完成：5 次 `playing`、5 次 `ended`，无播放错误；音频全部 HTTP 200 `audio/mpeg`，每段 47,232–47,952 字节；音频取回 8.7–13.2 ms；HTMLAudio 音量 1、muted=false。首次 `playing` 距“连续播报”点击 2,724.9 ms，五段总计 52,115.1 ms。
- 同一页面存在 1 个真实珂莱塔 canvas。探针仅在 `speaking` 事件把人物设为 speaking；暂停、结束和停止回 idle，error 进入 error。主应用 A 接线前不把探针结果冒充正式 UI 通过。
- 真实控制：长段 `speaking → paused → speaking`；恢复前没有 ended。播放中 `campus_change` 先让旧 generation stopped，再播放北洋园新 generation；旧 ended 没有污染新状态。
- 真实失败：无效声线返回 `voice_unavailable`。完成五次后 Edge 又两次返回 `NoAudioReceived`，后端脱敏为可重试 `tts_unavailable`；没有切换人物框架、播放预录音或伪造成功。
- ASR：向真实 8002 端点提交内存生成的合法 16 kHz 单声道 PCM16 WAV，返回 HTTP 503；独立 ASR 服务仍未配置。R2 未获得真实麦克风中文转写，浏览器降级的权限允许路径未复验。

### 可听性判定

Chrome 是 headless 会话，虽有真实解码、`play()` resolved、AudioContext running、非静音音量和完整 `playing/ended`，自动化无法证明人耳实际听到。R2 另用系统 ffplay 直连一次性音频尝试可听复验时，Edge 正处于 `NoAudioReceived`，没有得到新音频。因此本轮 **AUDIBLE_NOT_VERIFIED**，不能把 S01 写 PASS。第一轮 handoff 记录过 6.60 秒 Edge MP3 经 ffplay 播放完成，那是历史证据，不替代本轮现场听音。

## M/A 最小装配请求

1. M 在共享 `SpeechController` 类型补充具体类已经实现的三个方法：`replay(): Promise<AdapterResult>`、`continueRemaining(): Promise<AdapterResult>`、`playVerbatimUrl(run,text,segment_id,explicitRequest): Promise<AdapterResult>`。不需要新依赖或后端字段。
2. A 只创建一个 controller；自动播报开关的点击处理里 `await enable(true)`，不要在读取持久化偏好时冒充已激活。用 `getAdapter()` 启动 ASR，保证监听前停止播报。
3. A 在有效 `answer_delta` 到达时 begin/append，在 completed 用权威 final_text 调 finish；默认 mode=brief。根据 subscribe 的真实 speaking/idle/error 驱动 AvatarAdapter 和可点击恢复文案。主界面继续显示完整 Markdown。
4. “全文”按钮明确标为从头播；“继续讲”调用 continueRemaining；段落/选区调用 playSegment；停止播报只调用 B.stop，停止回答再由 A 取消模型并调用 B.stop。
5. 共享 Vite 的 `.worktrees` deny 仍会误拦开发树内源码，已有第一轮 `docs/requests/B/vite-dev-fs-allow.md`。本轮真实探针使用 B 路径内受限配置，仅允许当前 frontend/shared 并继续 deny `.env`/`.runtime`，没有修改 M 的公共配置。

## 未完成与环境边界

- 正式 A 页面自动播报、全文/继续/选区按钮、恢复入口和人物状态装配尚未在本分支验证，归 A/M。
- 当前没有独立 ASR 服务、真实中文转写或已允许麦克风证据；浏览器识别仍只能作为显式在线/系统降级。
- 当前 R2 没有可供自动化证明的“人耳实际听到”证据；需要 M 在正式页面用有声设备完成一次现场听音和连续 5 次验收。
- Firefox、Safari、移动端、浏览器 SpeechSynthesis 的精确暂停位置和长时间压力未验证。
- 珂莱塔素材、哈希、许可、Core 署名与第一轮 handoff 一致；本轮未改人物资产或授权结论。

交接提交完成后，B 停止写入，等待 M 评审返修。

## M1-R2 返修交接（B01–B05，2026-09-14）

审查基线：08ede98ea0471fb6331489a0956c9411cfa82240。本次只追加 B 授权实现、隔离测试和本交接，没有修改共享契约、入口、依赖或 M 的 REWORK。

|编号|修复前独立复现|本次最小修复与证据|
|---|---|---|
|B01|Markdown 标签闭合的 ] 与链接的 ( 跨 chunk，标签含句号时先读出 [ 并漏后文字符|未确定的链接/图片标记缓冲；每次消费校验已发前缀不可变。测试遍历该 Markdown 字符串所有二段切点，增量拼接严格等于完整净化；权威正文改写前缀明确失败。|
|B02|旧播放 Promise 返回失败把新 generation 从 speaking 改为 error；旧播放器 cleanup 可移除新回调|controller 在异步准备、播放和恢复后验证 state/item；begin 有转换代次；旧预取完成不清除新预取。adapter 的迟到 play Promise 不发回调、不清新播放器，解码后再验取消。恢复 speaking 来自实际 playing/onresume。停止端点等待最多 5 秒，上游未确认仍为 unconfirmed。|
|B03|切校区/清空后 continueRemaining 或 replay 可以恢复旧校区音频|clear/new_request/cancel/campus_change 无论是否还有 activeRun 都清除回放缓存。仅 user 停止保留缓存供明确重播/继续。四原因逐项回归。|
|B04|六个短句合并为一段后被误算一句，全部进入短播|先按实际句边界限制最多两句，再应用 220 字上限；超长首句尽量在标点/空白处封口，不追加伪造总结，未覆盖正文可继续播放。六短句、超长首句和继续后全文一致性回归通过。|
|B05|音色前端 4 秒早于后端 10 秒截止，浏览器音色仅等 1.2 秒|服务端音色等待 15 秒，浏览器 voiceschanged 最多 5 秒；每次显式 listVoices 为一次新尝试，无自动轮询。缩放计时隔离测试验证等价 6 秒服务响应、2.5 秒 voiceschanged、失败后显式重试成功。不是实际外网性能测量。|

同时将 probe.html 的虚构建筑营业时间/教室数量改成明确不陈述校园事实的声音测试句。时间、楼号净化输入仅保留在隔离 tests。选段超过 4,000 字时分成有界 FIFO 段；纯 URL/空净化结果明确 speech_empty。TTS 准备失败不会因为新正文增量自动重新请求，需显式恢复重试。

本次实际命令与结果：

- node scripts/check-adapters.mjs：PASS，当前 speech.js 重新构建（113 modules）。
- node --test tests/speech/adapter.test.mjs tests/speech/controller.test.mjs：**20 tests / 20 pass / 0 fail**，其中 adapter 3、controller 17；全为隔离替身，不联网、不更新真实服务在线状态。
- npm.cmd run build：PASS，TypeScript noEmit + Vite，132 modules transformed。
- git diff --check：PASS，仅 Windows CRLF 正常转换提示。

未重跑真实 Edge TTS、浏览器播放器和麦克风测试。先前 headless 媒体事件仍不等于人耳可听，正式 A 页面接线与真实听音由 M 在候选集成检查；S01/S06/S07/L03 的实测缺口没有因此自动关闭。没有 ASR 服务或地图凭据变更。

供 A 装配：使用具体 CampusSpeechController 的 getAdapter()/replay()/continueRemaining()，播放启用和恢复必须由明确用户点击触发；ASR 开始前应调用 controller.stop('new_request')，避免只停止 adapter 音频而留下 controller 队列。读取音色失败后保留显式刷新按钮。全文/选段由同一个 controller 播放。

新增提交完成后 B 已停止写入，可以由 M 按祖先关系合并及独立复验。本报告不自行关闭共享 REWORK，不以隔离测试替代真实可听验收。
