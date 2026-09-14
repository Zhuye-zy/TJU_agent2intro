# B 交接：人物与语音适配

日期：2026-09-14  
状态：**DONE（B 范围）**。Live2D 与中文 TTS 已真实运行；ASR 在缺少独立服务配置和可授权真实麦克风的环境下按契约降级，真实转写明确未验证。

## 交付结果

- `KelaitaAvatarAdapter` 使用项目已选的 PixiJS 6.5.10、pixi-live2d-display 0.4.0 和本机 Cubism Core；按顺序加载 Core/renderer/model，响应容器尺寸，释放 ticker、ResizeObserver、纹理、model 和 canvas。
- 人物业务状态与 renderer 分离，只接收 `idle/listening/thinking/speaking/error`。状态驱动头部、视线、眉毛、呼吸和身体的轻量参数姿态；renderer 不调用 LLM，也不持有会话历史。
- `CampusSpeechAdapter` 默认走 vad-web → PCM16 WAV → 独立 `/api/speech/asr`；另提供显式 `recognitionMode:'browser'` 降级。浏览器识别/合成都标明为浏览器在线或系统能力，不称离线。
- TTS 使用已有 edge-tts 7.2.8，异步列出中文音色；前端以真实 `playing/ended/error` 事件触发回调。播放前停止监听，避免把自身播报重新提交。
- 前后端都按 request/session 登记和取消。新播放会清掉旧 fetch/HTMLAudio/SpeechSynthesis；generation 检查阻止旧音频完成事件改变新状态。服务端最多 64 个运行语音操作。
- 音频只通过 `/api/speech/audio/<32位不透明ID>` 同源获取，一次读取后删除；最多保留 10 分钟、128 份或 100 MiB，启动时恢复有效清单并删除未完成 `.part`。
- ASR 严格校验 base64、RIFF/WAVE、PCM16、16 kHz、单声道、完整帧和最长 30 秒。`CAMPUS_ASR_*` 缺失或错误复用 GLM chat URL 时返回明确 `asr_not_configured`，不会借用 GLM 密钥/地址。

## 只读素材盘点与选择

素材源始终只读，未运行 EXE/DLL/Python/JS，未修改 `C:\Users\ASUS\Desktop\desktop-pet`。根目录确有完整桌宠程序、OLV 副本和训练模型；本项目没有把桌宠软件当底座。

选中的 `Open-LLM-VTuber/live2d-models/kelaita` 是 Cubism 3 Live2D：1 个 659,264 字节 `.moc3`、3 张 2048×2048 PNG、1 个 model3 manifest、physics3、cdi3 和 1 个 exp3。manifest 声明 `ParamMouthOpenY`、`ParamEyeLOpen`、`ParamEyeROpen`；cdi 另列头/身、视线、眉、呼吸、鼠标等参数。没有 `.motion3.json`、VRM、GLB 或 GLTF。唯一 expression 只增加 `Param24` 水印，因此没有作为情绪暴露，原水印继续保留。

桌宠源还有三种界面模式，但未复制：

- standard：所选 Live2D 本体，另有 15 张手部帧和鼠标/数位板桌面叠图；这些是桌面输入表现。
- keyboard：独立 32,128 字节 moc3、3 张 1024 纹理、2 个 1.633/2.333 秒循环 motion、1 个 FLAC，以及 face/键盘/左右手序列帧；是键盘桌宠逻辑，不属于所选 standard 模型。
- gamepad：独立 496,576 字节 moc3、1 张 2048 纹理、3 个 expression，以及摇杆/按键/左右手序列帧与 6 个 FLAC；是手柄桌宠逻辑。

OLV 的 `model_dict.json` 还列出 mao_pro、shizuku；它们不是用户指定角色，未复制。`models/gpt-sovits/珂莱塔_ZH` 的 ckpt/pth/参考音频也未加载或复制，因为音色来源与再分发许可未核验，且会引入另一套重型推理栈。

## 必要资产与哈希

项目本机副本位于 `frontend/public/assets/kelaita`，Cubism Core 位于 `frontend/public/vendor`；两者被 Git 忽略并由现有 `scripts/Copy-LocalAssets.ps1` 从项目本机归档复制，因此运行不依赖 C 盘素材路径。没有复制 node_modules、密钥、桌面叠图、音色模型或程序文件。机器可读清单是 `frontend/src/avatar/assets.manifest.json`。

|相对 kelaita 源路径|字节|SHA-256|
|---|---:|---|
|`ReadMe.txt`|1,408|`f43cf6ea44971664c31413ae45a74900701902f1d74bf7bb583af50b5e443b1a`|
|`runtime/kelaita.model3.json`|621|`b5ef75441c557a65771ecb8cfc0892f3ee049816ad5067c023d063ae395290bd`|
|`runtime/kelaita.moc3`|659,264|`95e607f1487a07f869666f8959c62605cdc1d2414fe69e2295d24924f2c11d7c`|
|`runtime/kelaita.physics3.json`|3,633|`a3a3e6c1ce8757c477ec63e4b63f1f98cfef90e12501b22653c762aaeb336d12`|
|`runtime/kelaita.cdi3.json`|4,000|`5538efcca74f23912213197dcbeb1e34215079c5cb38c8820ef363ef0f08d8d`|
|`runtime/Live2d_expression0.exp3.json`|114|`31779a3ebb86e5e2b9d71a56cdfd583b52a94abe4b11d8e2599526c2a0108b13`|
|`runtime/kelaita.2048/texture_00.png`|868,542|`f504ee7329123e56d8ab5c5919d86a125a673e9dc861b5faaa1f50dfa53f4eb0`|
|`runtime/kelaita.2048/texture_01.png`|1,214,338|`4fd6d8b9ced585c1213b0cbad1cbe1188fd8a6f4a44a0738891774562987fbb9`|
|`runtime/kelaita.2048/texture_02.png`|719,266|`f566c1a0a271c13abd471a4b755b42554d6c756b38e6b7f6c4832815ed2dcbdd`|

必要 Cubism Core 为 206,492 字节，SHA-256 `942783587666a3a1bddea93afd349e26f798ed19dcd7a52449d0ae3322fcff7c`，来源与固定提交见 `THIRD_PARTY_NOTICES.md`。

## 如实 capabilities

|能力|声明|依据|
|---|---|---|
|renderer|true|Chrome/SwiftShader 实际 `mount=ready`，720×620 canvas 中目视确认指定珂莱塔完整渲染|
|眨眼|有，参数驱动|实际资源含双眼开合参数；adapter 定时闭合/恢复，不称 motion|
|状态姿态|idle/listening/thinking/speaking/error|只调真实参数；无 motion 文件，`motions=[]`|
|表情|无|水印 exp3 未冒充情绪，`expressions=[]`|
|口型|none|虽有 `ParamMouthOpenY`，但没有 amplitude/phoneme/viseme 时间戳；当前保持闭口，不冒充同步|
|形变/3D|false/false|Cubism 2D，不是 VRM/骨骼 3D，也不称捏脸|
|定制|scale|`setScale(0.6—1.25)` 实际改变 renderer 尺寸；背景仍由 A 的展示层负责|

## 验证证据

- `npm.cmd run build`：通过；130 modules transformed，包含独立 cubism4/Pixi/VAD chunks。
- `.venv\Scripts\python.exe -m pytest -q`：10 passed；覆盖 WAV 格式/截断、ASR 未配置、TTS 一次性音频、重启恢复、取消和 session 冲突；仅有 Starlette 上游 anyio alias deprecation warning。
- 资产：9 个所选文件的大小和 SHA-256 在源与工作树本机副本逐项一致；运行路径只使用 `/assets`、`/vendor`。
- Live2D：实际 Chrome 加载 Core、moc3、3 张纹理、physics/cdi，`AVATAR=ready; CANVAS=1`；截图目视为指定珂莱塔和原水印。`dispose` 与并发 mount generation 已处理。
- Edge TTS：异步取得 14 个 zh 中文音色，首次列表约 1,092.6 ms；`zh-CN-XiaoxiaoNeural` 合成 6.60 秒中文 MP3 约 1,584.7 ms、39,600 字节、24 kHz 单声道 48 kb/s。ffplay 实际播放至 6.60 秒结束。Edge 是联网服务，不是完全离线。
- 浏览器播放/中断：Chrome 中 `PLAYBACK_STARTED=true` 后 450 ms 调用 stop，返回 `local_stopped=true`；再等 1.2 秒 `STALE_END_CALLED=false`，证明旧 ended 没有回写。此时合成已完成，服务端如实返回 `upstream_stop=not_started`。
- 权限/失败：无 autoplay 授权时得到 `playback_permission_denied`；浏览器中文识别模式可启动，当前无头 Chrome 麦克风被拒后回调正确 request ID 与 `permission_denied`，随后 stop 清理成功。Edge 异常只记录异常类型并返回脱敏 `tts_unavailable`。
- ASR：有效 PCM16 请求在缺配置时实测为 `asr_not_configured`/503。没有独立 ASR URL/model/key，也没有获准真实麦克风输入，所以未得到真实中文转写；VAD 模型加载、真麦克风采集延迟和浏览器识别结果均标记未验证。
- 未验证环境：Firefox/Safari、移动端、真实 GPU WebGL、长时间音频压力、屏幕阅读器；Chrome 使用 SwiftShader 验证 renderer。

## 许可与署名

OLV 软件代码是 MIT，但其 LICENSE 明确排除 Live2D 样本模型；kelaita ReadMe 只记录从 `A珂莱塔（启动）/img/standard/cat_model` 复制改名，没有给出明确人物再分发许可。珂莱塔/鸣潮为第三方角色，用户指定本机首版使用不等于取得对外发布、改名或商业授权。Cubism Core 使用独立专有条款；pixi-live2d-display 为 MIT。资产/Core 继续保持本机忽略文件，对外分发前必须由总控核验权利并保留来源与水印。

## 总控接线与请求

- `docs/requests/B/vite-dev-fs-allow.md`：共享 Vite 8 开发服务器的 `fs.allow` 相对路径会解析为 `frontend/frontend` 与 `frontend/shared`，导致源码 403；B 未改 M 的配置。
- `docs/requests/B/integration-health.md`：给出 M/A 的最小装配顺序。无需新增依赖、锁文件或契约字段。
- M 合并后运行现有 Copy-LocalAssets；A 在自己的 UI 中 mount adapter，并严格以真实播放 callbacks 切换 speaking。当前 M0 App 只实例化兼容别名且没有 mount，这是入口装配边界，不影响 B 模块验收。
- health 仍是 M 独占静态值；可按 M 的运行态策略把已实测 TTS 标为可用，ASR 必须保持 false，直到有独立服务并完成真实转写。
