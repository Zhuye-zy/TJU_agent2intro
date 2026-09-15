# R3 B 交接：语音与数字人

## 交付状态

- 日期：2026-09-15；窗口：B；整体 **PARTIAL**（实现与隔离验证完成，真实 ASR/浏览器验收阻塞）。
- 工作树：`E:\AI4TJU\.worktrees\avatar`；分支：`work/avatar`。
- `BASE_COMMIT_R3` / `r3-launch`：`0bf2e4bc8f49a9697878eaf0db614a1017ace5c1`；已核对 M 的 `parallel-state.json` 为 `R3_READY`、四树同号。
- 已读 AGENTS、提示词包0—2节、原四份协作规范及 R3 冻结规范。同步 COORD_COMMIT：无新增。
- 实现提交：`428e2556ee29c8da81c1425d553d2fa223f82787`。配置协调起始提交：`c348f0b`（编码在实现提交中修复）。本交接最终提交用 `git log -1 --format=%H -- docs/R3/handoffs/B.md` 定位，最终报告给出 HEAD。
- **已停止修改：是**。交接提交完成后只做 Git 只读核验；未推送、未合并。

## 能力表

|能力|实现/隔离状态|真实状态与边界|
|---|---|---|
|独立中文 ASR|复用 OpenAI-compatible ASR + vad-web；中文 final 与安全错误测试通过|BLOCKED：现有8000进程 health.asr=false，M尚未提供B专用配置|
|中间文本/最终文本|冻结 partial/final 回调桥接，正文只交给A|服务器是非流式 ASR，只产生 final；不伪造 partial。旧显式 browser 模式支持中间文本，未实测|
|连续多轮|显式 continuous；一只麦克风顺序识别5段；A边界模拟5轮通过|S01/S02：真实5轮麦克风→模型→可听TTS待验；服务器单段29秒上限|
|确认发送/自动发送|B仅报告final，A选择发送时机；隔离A边界模拟通过|A业务按钮、真实模型发送未在B树改动，集成待验|
|播放中插话|interrupt()立即失效旧队列并报告speech.interrupted；耳机模式VAD门槛测试通过|扬声器默认按键插话；自动耳机模式为unverified，非可靠说话人分离|
|扬声器防回录|默认播放及800ms尾音内不接受ASR；污染整段丢弃；短VAD误触发不插话|扬声器实际不反复自打断待验；保护期内开始说话会丢弃该段，应等尾音结束|
|原播放能力|保留增量净化、串行/预取队列、四音色、全文/选段、重听/继续、暂停恢复|37项前端回归通过；合成/测试播放器均不等于用户听到|
|停止与资源释放|采集/模型加载超时、ASR超时、拒权、不可用、取消、迟到授权/响应测试通过|上游stop仍如实unconfirmed；真实设备权限/切校区释放待验|
|基础嘴形|真实播放器Analyser RMS→ParamMouthOpenY，标为amplitude；静音/暂停/结束/取消归零|S03：实际人物画面与声音一致性待验；没有音素/精确中文口型；browser TTS无PCM故口型零|

## 实际改动与复用

只改 B 授权目录与 B 文档；未改 shared、应用入口、A/C/D业务、依赖和锁文件。未读取/复制根 .env；未提交录音、密钥或识别正文日志。

- `frontend/src/speech/adapter.ts`：同一适配器内拓展显式连续采集，复用固定vad-web v5与PCM16 WAV编码；麦克风请求echoCancellation/noiseSuppression/autoGainControl。VAD正/负阈值0.85/0.65，最短480ms、结束等待650ms、预留250ms。耳机自动插话另要求概率≥0.9、RMS≥0.025持续480ms，且设备报告echoCancellation=true，每段至多一次。默认不启用自动插话。
- 开始加载/授权20秒、ASR35秒、单段29秒边界；超时即本地失效与释放。权限迟到授予仍停轨道；忽略不响应AbortSignal的迟到成功与错误。连续模式等待期间不设闲置自动停止，需用户stop/离页dispose。
- `interaction.ts`：冻结入口与事件快照；同一controller注入、capabilities/中文错误说明、bind、interrupt、stop/dispose。识别使用独立speech request ID，避免ASR停止误取消同一队列预取的TTS；发给A的事件保留A传入的业务request/session/campus/generation。
- `controller.ts`：真实onStart/onEnd边界发布带run快照的playback事件；stop同步失效旧队列。原接口继续兼容；replay(run?) / continueRemaining(run?) 可接A提供的新代次。
- 播放器同一HTMLAudioElement接入Analyser，每帧计算真实RMS，经静音门槛0.008及增益6映射0..1，再乘播放音量。不用测试波形或随机值作为生产口型。声音暂停、等待缓冲、结束、错误、取消与dispose均归零。
- `avatar/adapter.ts`：setAudioLevel与Cubism的beforeModelUpdate钩子，在核心模型更新前写入嘴形，避免在参数恢复后写入导致画面无效。人物局部姿态仍接A的setState，不建全局状态。
- `backend/speech/service.py`：复用SDK/edge-tts，ASR安全超时码及client.close；操作持取消标志，供应商吞掉取消也不能提交文字/迟到音频文件。
- `speech/probe.html`：原播放探针接实际RMS嘴形。按钮“5次播放”只测试TTS，绝不当作五轮语音往返。

## A 装配说明

```ts
const speech = createSpeechController(); // 复用现有实例
const interaction = createSpeechInteractionController({ speechController: speech });
const options = {
  context: { interaction_id, session_id, campus_id, generation_id, request_id },
  mode: 'continuous' as const, // 仅用户明确选择后
  onEvent: handleSpeechEvent, // A拒收过期快照，partial展示；final等待确认或按偏好发送
  onAudioLevel: (level: number) => avatar.setAudioLevel(level),
};
interaction.bind(options); // 仅绑定新任务播放事件；不会开麦克风
// 用户点击开启语音：同一个点击回调内先调用speech.enable(true)，再start
await speech.enable(true);
await interaction.start(options);
// 按钮/键盘插话：await interaction.interrupt();
// 停止/取消：await interaction.stop('user');
// 切校区：先await interaction.stop('campus_changed')，再绑定新上下文。
```

1. 无参工厂也可用，但随后必须用 `interaction.speechController`；不要再建另一队列。A不再调用另一套麦克风/播放器。
2. 每个新请求先失效旧上下文/请求，调用B.stop释放，再以新的完整快照bind；若用户仍开启连续模式，再start。未开启、刷新恢复或保存恢复不自动开麦。
3. `speech.interrupted` 表示B已执行旧队列的stop；A负责取消对应回答任务。若A还执行完整interaction.stop（会关闭麦克风），必须在新代次重新start，并提示用户重新发言；不要把旧采集结果迁移进新代次。A/M集成需核对这一早期插话与重新采集顺序。
4. bind必须在speech.begin/playFull/playSegment之前；如需R3重听/继续事件，先bind(A的新run快照)，然后 `speech.replay(newRun)` / `speech.continueRemaining(newRun)`。无参数兼容旧R2方法仍播放，但新B生成代次与旧A快照不匹配时R3事件会被拒收。
5. 播放失败映射冻结playback_failed；ASR超时等映射recognition_failed，细分原因从start返回或interaction.capabilities.error_code取，再用RECOGNITION_MESSAGES展示。不能给冻结事件增加未批准枚举。
6. 服务器连续模式支持多轮；显式浏览器ASR降级只支持原单段模式，continuous返回continuous_not_supported，不暗中切换服务。
7. 采集、识别、播放均属于B；模型/会话/回答取消、确认/自动发送偏好属于A。识别正文不放入runtime日志。

## 验证记录

### 隔离（FIXTURE_PASS，不是现场PASS）

在B独立依赖内运行，测试每次从当前源码构建，模拟fetch、VAD、麦克风、播放器、AudioContext及provider；未调用真实模型/ASR。

|命令|结果|
|---|---|
|`node --test tests/speech/adapter.test.mjs tests/speech/controller.test.mjs tests/speech/r3.test.mjs`|37 passed：原22 + R3新增15|
|`.\.venv\Scripts\python.exe -m pytest -p no:langsmith -q tests/speech tests/test_r3_contracts.py`|19 passed：speech12 + R3契约7；一条既有Starlette/anyio弃用警告|
|`npm.cmd run typecheck`|PASS|
|`npm.cmd run build`|PASS，144 modules；入口尚由A/M装配R3语音|
|`git diff --check`|PASS|

新增测试包括：一只麦克风五段中文、五个上下文A选择发送模拟、可信VAD门槛、扬声器整段丢弃、按键插话、麦克风拒权、ASR/加载超时、服务不可用、迟到权限/结果/错误、并发start、静音/暂停/结束/取消归零；后端中文响应/空结果/超时/不可用与client关闭，吞取消后ASR/TTS无提交。

最终整组首次在默认沙箱写E盘.runtime时被拒绝，未计通过；经工具提权重跑37/19全部通过。Windows管道最初造成新中文文本变问号，已改UTF-8并核查本次变更无连续问号，中文文本精确断言通过。

### 真实/只读证据

- 2026-09-15只读 `http://127.0.0.1:8000/api/health`：chat=true、asr=false、tts=false、knowledge=true、scene_3d=false。此为既有进程，非B新代码的真实服务验收。
- CUA浏览器清单为空；创建Chrome验收标签返回 `Browser is not available: chrome`。未绕过工具启动其他自动化浏览器，未进行真实录音或听音。
- 未新增真实ASR、模型或TTS合成调用；没有以旧合成记录或隔离音频宣称用户已听到。

## 外部依赖与待验收

配置请求：[B→M/A协调](../../requests/B/R3-speech-coordination.md)。M提供B专用8002进程配置，不发密钥给B。现有库和固定依赖均复用，无新增依赖。

- **S01 BLOCKED**：真实独立中文ASR + 用户麦克风授权；A发模型、实际中文播报听音。
- **S02 NOT_TESTED（live）**：连续5轮、确认/自动发送、说话中插话；扬声器不反复自打断、耳机自动模式可靠性；A代次及早期插话重新采集装配。
- **S03 NOT_TESTED（live）**：人物画面、真实RMS与发声起止同步，暂停/结束/取消闭嘴。
- **S04 / T08 / T09 / T12**：B边界隔离通过，A集成与真实切校区/取消/暂停恢复仍待验。
- 本地可视补验：M配置8002后，在B树以已有 `frontend/src/speech/vite.probe.config.mjs` 启动5175探针，访问 `/src/speech/probe.html`。资源/vendor/vad、/vendor/ort、kelaita及Cubism Core沿用本机现有资产；授权再分发仍沿原许可边界。探针只测试播放/嘴形，真实五轮须A集成页面验收。

未提交录音、识别正文日志、秘密、生成音频或第三方人物素材。整体交付保持PARTIAL，等待M1独立集成与现场验证。
