# COORD-002：A/B语音单队列装配
受影响窗口 **A、B**；依赖仅r3-launch，与COORD-001无依赖。其他窗口无需同步。本文件所在提交为COORD_COMMIT。

## 裁定
B已有interaction.ts工作中实现；M不复制/修改B未提交业务。冻结shared/r3-speech.ts的ConnectedSpeechInteractionController：bind、interrupt、speechController、capabilities，以及接收现有SpeechController的工厂依赖。旧基础接口可选兼容。

A使用公共frontend/src/transport/r3-speech.ts的connectSpeechInteraction(factory, existingController)。它确认B返回的speechController就是A原来的同一个对象，禁止无参工厂再创建一条队列；只连线，不自动启麦/播放。A当前App中的无参createSpeechInteractionController调用需要按此修正。

B工厂可以保留无参独立使用，但接到A传入speechController时必须复用；实际适配器扩展方法/getAdapter/subscribePlayback由B校验与实现，无法接入时明确报错，不能静默另建队列。B实现公共工厂签名时不要把对外参数限制成A无法持有的私有类型。

bind只更新快照，不启动采集；新request/session/campus/generation时A先await stop使旧采集/播放失效，再bind新options。播放未开麦时也绑定，才能收到真实播放事件和RMS。start只能来自明确用户开启。partial不发模型，final提交/确认和模型取消仍由A决定。

interrupt由明确按钮触发，B停播放并发事件，A取消模型请求。默认扬声器模式维持手动插话；automaticBargeIn只在用户明确选择耳机后启用，能力标headset_vad_unverified直到现场通过。不要把有事件类型当自动插话已验收。

AvatarAdapter增加可选setAudioLevel(level)，A可直接调用可选方法；B使用真实音频RMS，停止/静音归零。音量采样不写日志。capabilities不能把合成音频、URL取得或浏览器speechSynthesis当PCM驱动口型已验证。

## ASR阻塞的实际结果
M显式读取根.env后，只记录布尔：asr_url=false、asr_model=false、asr_key=false；尚无可用于B专用8002进程的独立ASR配置。没有复制根.env，也没有将LLM作为ASR。已向用户询问是否有本机独立配置路径；缺失期间保留BLOCKED，继续队列/代次/RMS隔离测试。

验证：主目录TS类型通过；connectSpeechInteraction隔离测试验证同一队列、默认不自动插话/启麦、错误工厂清理拒绝。真实中文五轮、扬声器回录、听音与人物画面仍由B/A现场验收。

同步前先提交各自业务现场；只cherry-pick本协调提交，不拉入未关联字段。A/B收到对方最终业务提交后再做真正装配测试。