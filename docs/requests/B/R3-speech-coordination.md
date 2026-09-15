# B → M/A：R3 语音配置与装配协调

基线：0bf2e4bc8f49a9697878eaf0db614a1017ace5c1；work/avatar；M 回执 R3_READY。

## M：真实 ASR 配置（外部阻塞）

请通过已有配置为 B 的 127.0.0.1:8002 专用进程提供独立 OpenAI-compatible ASR URL、model、key；由 M 读取根配置并启动，B 不读取/复制根 .env。只需回复端口与 configured 状态，不传秘密。2026-09-15 读取现有 8000 /api/health：asr=false，tts=false。LLM 网关不可当 ASR。

## A：唯一语音资源装配

createSpeechInteractionController({speechController}) 传入 A 现有 createSpeechController 返回对象，共用 adapter/串行队列。无参工厂则使用返回对象的 speechController，不再创建一个。先 stop 失效旧采集和播报，bind 绑定新上下文；仅用户明确开启后 start。final 只回调，确认/自动发送、模型请求/取消由 A 执行。每次 request/session/campus/generation 变化必须新快照；旧回调不会重标记。

连续模式扬声器播放及800ms尾音期间丢弃整段识别，按钮调用 interrupt；自动模式仅显式耳机选项 automaticBargeIn=true，需现场验证。基础嘴形来自真实播放器 Analyser RMS；browser speechSynthesis 无 PCM，口型零。

冻结事件 error_code 仅 recognition_failed 等五种枚举；细分超时/不可用在 start 返回及 capabilities.error_code 显示。部分识别仅浏览器旧适配支持，当前非流式服务器只产生 final，不造 partial。不改 shared，具体接线见 docs/R3/handoffs/B.md。

独立继续：取消/代次、权限/超时、串行队列兼容、RMS、隔离测试。真实中文五轮、听音、扬声器回录与人物画面待验收。
