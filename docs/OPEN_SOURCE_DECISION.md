# 开源选型决策 · M0 / 2026-09-14

## 冻结结论

**主路线：成熟组件组合。** React/Vite + FastAPI，直接依赖PixiJS/pixi-live2d-display、vad-web/ONNX、OpenAI Python SDK、edge-tts、LangGraph。不是OLV/AIRI完整fork，没有将任何既有Vue项目迁移React，也没有继承现存应用协议；按任务要求使用统一POST /api/chat + GET /api/runtime/events轮询。用户提示词包0—2节已保存并核对；首版kelaita已确定。M0仅建立可运行stub，业务留给A/B/C/D。

真实原因：OLV后端1.2.1依赖包含torch/sherpa/onnxruntime及多云SDK，完整前端独立许可证存在额外商业条件，且所钉build与可编辑源码不是同一提交；AIRI为大型beta workspace，人物/音频私有包有catalog与内部依赖、完整API配套服务较多。用户允许自行解决适配问题，故接受独立导游前端、语音队列/取消衔接的集成工作，复用已发布运行库、SDK和工作流框架。没有把“只读参考”计作代码复用。

## 实际版本与审查范围

下表SHA均本轮读取官方GitHub API或npm gitHead取得；详细原始OLV/AIRI README、清单、树和关键文件在docs/research。来源均官方，网络可用；没有clone多个大仓，也没有执行本地桌宠。

|项目|实际版本/提交|本轮读取与判断|复用强度|
|---|---|---|---|
|[Open-LLM-VTuber](https://github.com/Open-LLM-VTuber/Open-LLM-VTuber/tree/992309c0aa19845960228f880013d4685fde93b5)|1.2.1 / 992309c0aa19845960228f880013d4685fde93b5|README/LICENSE/pyproject/.gitmodules，server/routes/websocket_handler、conversation_handler、ASR/TTS接口、openai_compatible_llm|仅设计参考（本项目不复制其应用源码）|
|[OLV-Web源码](https://github.com/Open-LLM-VTuber/Open-LLM-VTuber-Web/tree/d176e7df2366952e3bacbf12cf9a8b18a4315932)|1.2.1 / d176e7df2366952e3bacbf12cf9a8b18a4315932|React18/Vite5/Chakra；use-live2d-model、use-audio-task、use-interrupt、websocket-service；LICENSE|UI/hooks未采用；仅其单独许可的第三方Cubism Core二进制运行库本机复用|
|OLV所钉frontend build|06a659b114fff788cf0daaa86e484576db4975bf|gitlink已核对，不能声称与源码main同版本产物|未采用|
|[AIRI](https://github.com/moeru-ai/airi/tree/9f30a1977e09b3d68759492c5f8f775eb4502184)|0.12.0-beta.5 / 9f30a1977e09b3d68759492c5f8f775eb4502184|README/LICENSE/package/pnpm-workspace，stage-web/server API清单与compose，provider-inference、speech-pipeline/playback-manager、live2d composable|仅设计参考|
|[LangGraph](https://github.com/langchain-ai/langgraph/tree/e539ac122f4126f6dd850581c1494948cf620e31)|1.2.11 / e539ac122f4126f6dd850581c1494948cf620e31|README/LICENSE、libs/langgraph/pyproject.toml、libs/langgraph/langgraph/graph/state.py|直接依赖，backend/model/service.py实际编译StateGraph stub|
|[FastAPI模板](https://github.com/fastapi/full-stack-fastapi-template/tree/cb740b656d7a0a6c5e12c7bf8e50343ec94ee9c7)|backend app0.1.0 / cb740b656d7a0a6c5e12c7bf8e50343ec94ee9c7|README/LICENSE，backend/pyproject、frontend/package，backend/app/main.py与api/main.py|仅设计参考分目录/路由装配；不复制认证/PG/邮件/Sentry|
|[TalkingHead](https://github.com/met4citizen/TalkingHead/tree/eed58d198076a7e1e825f804802921c4d3804d46)|1.7.0 / eed58d198076a7e1e825f804802921c4d3804d46|README/LICENSE/package；GLB、Mixamo兼容骨架、ARKit/Oculus viseme要求|未采用；kelaita非此模型路径，不深入|
|[three-vrm](https://github.com/pixiv/three-vrm/tree/1b4fc0cc7ef39a49d62bb7a66dcfeca8f65316f7)|3.5.5 / 1b4fc0cc7ef39a49d62bb7a66dcfeca8f65316f7|README/LICENSE、packages/three-vrm/package.json；GLTFLoader+VRMLoaderPlugin|未采用，无VRM资产，不自带对话或捏脸|

FastAPI模板当前清单要求Python>=3.14；完整模板不适合本次Python3.11环境直接套用。LangGraph自身Python>=3.10，实际安装1.2.11；它还有langchain-core/checkpoint/sdk/prebuilt等传递依赖，不是零成本，不需要启用LangSmith/云服务。其存在不证明网关支持tools；C先实现固定workflow和非流式文本。

## 功能、稳定性与启动成本对照

|维度|OLV完整底座|AIRI完整底座|本次组件组合|
|---|---|---|---|
|实际前后端|Python FastAPI + 独立React/Electron/Web|Vue/Pinia/Vite多应用 + Hono API；不是纯前端|React19.3/Vite8.3 + FastAPI0.141；仅localhost|
|GLM|AsyncOpenAI服务端适配已有，可配base_url/model/key|OpenAI兼容provider已有，浏览器provider需改自有后端持钥|SDK直接依赖，固定指定URL派生base_url；M0未请求网关|
|ASR/TTS|现有多provider、numpy音频与文件音频抽象|客户端转录与多provider，pipeline私有workspace|vad-web活动检测 + OpenAI兼容ASR SDK入口 + edge-tts；服务配置/真实调用归B|
|打断|停止播放/口型、清队列、interrupt-signal、后端task.cancel|AbortSignal贯穿pipeline/playback intent|复用VAD/async SDK，B补播放队列与取消衔接；C取消登记M0已建；绝不把task.cancel当上游确认|
|人物|Cubism Live2D完整hook链|Live2D/VRM，与多个内部包耦合|Pixi6 + Cubism4插件 +独立Core/kelaita；renderer stub，可替换|
|校园UI/数据/日志|需改历史、界面、动作和事件边界|同样需要业务改造，完整后端compose含PG/Redis/auth/Caddy|业务目录明确，检索/模型/语音按冻结接口分工|
|当前稳定性|README告知v2重写处于规划，v1修bug；源码/build需配套验证|beta包、多workspace/private；不能当稳定独立npm SDK|选择可安装固定版本，锁文件已生成；核心构建经过本机验证，业务尚未验证|
|Windows成本|Python>=3.10,<3.13，需3.11；默认依赖重|pnpm@11.24.0当前未安装；大仓装配复杂|本机Node24.19/npm12/Python3.11；独立node_modules/.venv，当前可构建|

成熟组件组合也有真实代价：A/B/C必须按契约衔接采集、转录、播放、回调、状态与取消，不享有OLV整条链即用；M0不冒称已完成语音或人物效果。

## 直接依赖与实际复用落点

|成熟部分|安装版本|项目中的实际入口|
|---|---|---|
|React/React DOM、Vite、TS|19.3.0 / 8.3.0 / 5.9.3|frontend/src/main.tsx、vite.config.ts；真实页面构建|
|PixiJS + pixi-live2d-display/cubism4|6.5.10 + 0.4.0|frontend/src/avatar/adapter.ts loadRendererModules；scripts/check-adapters.mjs实际打包通过|
|vad-web（ISC，Silero模型MIT）|0.0.31，npm gitHead de9b3ff83fd44cd7a2b3e07e9454e6b6f0bc249d|frontend/src/speech/adapter.ts loadVadModule；独立适配器构建通过；不是ASR|
|FastAPI/Pydantic/Uvicorn|精确版本见锁|backend/app.py、backend/contracts.py，真实HTTP路由与验证|
|OpenAI Python SDK|3.13.0|backend/model/service.py create_client、backend/speech/service.py prepare_asr_client，构造入口；尚未联网|
|edge-tts|7.2.8|backend/speech/service.py prepare_edge_tts，未修改成熟provider；尚未调用服务|
|LangGraph|1.2.11|backend/model/service.py workflow，实际compile和not_implemented节点执行|

pixi-live2d-display0.4.0清单peer @pixi/* ^6，故没有盲装Pixi最新主版本。Cubism4可用于model3但具体资源兼容性需B实测。插件MIT：[固定标签许可证](https://github.com/guansss/pixi-live2d-display/blob/v0.4.0/LICENSE)。所有安装精确解析见锁文件，声明范围不冒充安装结果。

## 备选及切换条件

备选一：完整二开OLV，保留其FastAPI/React/WebSocket链；仅在组件集成成本证实过高且项目用途满足其实际许可时由M协调切换，不能让窗口私自更换传输或框架。备选二：需要真实VRM资产且可承担workspace时采用AIRI原Vue结构。当前两个备选均不clone、不安装、不拼进本仓库。

## 许可、素材、能力边界

OLV后端MIT，不等于OLV-Web纯MIT：前端Open-LLM-VTuber License1.0带Apache2.0附加条件，教育/非商业与付费托管、商业再分发有区别。因此本次不复制其UI/hooks。AIRI/LangGraph/模板/TalkingHead/three-vrm代码MIT不覆盖第三方模型。直接依赖许可原文已收集；edge-tts主体LGPLv3、srt_composer单文件MIT。

Cubism Core独立专有条款、Framework条款及kelaita素材来源分别保存，详THIRD_PARTY_NOTICES。用户指定kelaita用于首版本机展示；不复制桌宠工程、不运行其程序、不加载克隆音色。没有确认对外人物再分发授权，因此人物/Core为本地忽略资源。形象不是3D、没有动作文件，嘴形参数不是精确口型；不提供假捏脸/3D按钮。

## M0证据与交接

真实构建/启动及契约测试见docs/M0_VERIFICATION.md；路径/分支/基线见PARALLEL_RUN。模型密钥存在、服务在线、模型真实调用成功三个状态分开。M0不验证真实GLM/语音/渲染/知识，归对应窗口。早期缺包阻塞已解除，初次暂定判断留存在research/INITIAL_REVIEW.md作为历史证据，不再作为当前主路线。
