# B → M/A：人物与语音装配

## M 最小装配

- 合并 B 后保持 `backend.speech.routes` 现有 router 装配；它已新增同源一次性音频 GET 路由。
- `GET /api/health` 仍由 M 独占。Edge TTS 在本机实测成功后可将 `tts` 设为真实服务状态；
  不要把 ASR 设为 true，当前没有 `CAMPUS_ASR_*` 服务配置，也没有完成真实转写。
- 无依赖、锁文件或冻结契约变更请求。

## A 最小接线

- 使用 `createAvatarAdapter()` 并把专用容器传给 `mount`；聊天状态只通过
  `setState(idle/listening/thinking/speaking/error)` 传入。
- `speaking` 只在 SpeechCallbacks.onStart 中设置，onEnd/onFailure 时结束；onStart 来源是真实
  HTMLMediaElement/SpeechSynthesis 播放开始事件。
- 页面开始监听用默认 `createSpeechAdapter()`（VAD + 已配置服务端 ASR）。若服务未配置且产品明确展示降级，
  使用 `createSpeechAdapter({recognitionMode:'browser'})`；浏览器识别不是离线能力。
- 先 `await listVoices()`；`edge:*` 为服务端 Edge 音色，`browser:*` 是显式浏览器降级。
- 用户取消按冻结顺序调用本地 AbortController、`speech.stop(request_id)` 和 chat cancel；不要只 abort fetch。
