# AI4TJU M0 开源只读审查（暂定，2026-09-14）

审查范围：官方 GitHub README、LICENSE、依赖清单、Git tree、少量关键源码。只在 `C:\Users\ASUS\ai4tju-review` 保存单文件证据；未 clone、未安装、未执行任何候选项目，未修改 E:\AI4TJU。网络可用，以下提交真实通过 GitHub API 获取。缺失用户要求必读的提示词包第 0—2 节，故本报告不是最终契约冻结。用户已明确首版形象使用 kelaita；desktop-pet 是形象来源，不是应用定位。

## 1. 版本与来源

| 项目 | 本次读取提交 | 清单版本 | 证据 |
|---|---|---|---|
| Open-LLM-VTuber 后端 | `992309c0aa19845960228f880013d4685fde93b5` | pyproject.toml `1.2.1` | [固定提交](https://github.com/Open-LLM-VTuber/Open-LLM-VTuber/tree/992309c0aa19845960228f880013d4685fde93b5) |
| Open-LLM-VTuber-Web 源码 main | `d176e7df2366952e3bacbf12cf9a8b18a4315932` | package.json `1.2.1` | [固定提交](https://github.com/Open-LLM-VTuber/Open-LLM-VTuber-Web/tree/d176e7df2366952e3bacbf12cf9a8b18a4315932) |
| OLV 后端所钉 frontend 子模块 | `06a659b114fff788cf0daaa86e484576db4975bf` | build 分支产物，未查其包版本 | [.gitmodules](https://github.com/Open-LLM-VTuber/Open-LLM-VTuber/blob/992309c0aa19845960228f880013d4685fde93b5/.gitmodules) 与 API tree 的 gitlink |
| AIRI | `9f30a1977e09b3d68759492c5f8f775eb4502184` | 根 package.json `0.12.0-beta.5` | [固定提交](https://github.com/moeru-ai/airi/tree/9f30a1977e09b3d68759492c5f8f775eb4502184) |

注意：OLV 源码前端 main 和后端 gitlink 指向的 build 并非同一提交，不能声称配套已验证。完整二开须导入可编辑前端源码并记录独立来源，不能只把 frontend 发行文件当源码。

## 2. 实际结构、能力与代价

| 维度 | Open-LLM-VTuber | AIRI |
|---|---|---|
| 前端 | 独立仓 React 18.3.1、TypeScript 5.5.2、Vite 5.3.1、Chakra UI 3；Electron 与 web 构建脚本并存 | Vue/TS/Pinia/Vite，大型 pnpm workspace；apps/stage-web、stage-tamagotchi、stage-pocket |
| 后端 | Python FastAPI；server.py 装配 routes 与资源；`/client-ws` 实际端点 | 有真实 Hono Node API，不能误称纯前端；server/apps/api 与 auth；另有 packages/server-runtime |
| GLM 接入 | AsyncOpenAI 可配置 base_url/model/key，后端注入 system；README 列 Zhipu。指定网关/model 尚缺，兼容性未实测 | provider-inference 的 openai-compatible 可配置 apiKey/baseUrl，调用 @xsai-ext/providers；既有 API 路由可用，但前端 provider 配置路径需改为自有后端统一持钥 |
| ASR/TTS | 已有 Python ASR/TTS 抽象和多个 provider；前端 VAD 与音频发送；ASR 默认为16kHz单声道，抽象收 numpy；TTS抽象返回音频文件路径 | README列客户端转录、多provider TTS；独立 pipelines-audio 提供分段/TTS/播放协调，使用 AbortSignal |
| 打断 | 前端 use-interrupt 停止当前音频/口型、清队列、发送 interrupt-signal；后端 conversation_handler 执行 task.cancel 与 agent.handle_interrupt | speech-pipeline 有 queue/interrupt/replace 以及 AbortController；playback-manager 按 intent/owner 取消并发播放，发 start/end/interrupt/reject |
| 取消边界 | 本地停止和 Python task.cancel 已有；不是供应商确认停止，不保证 to_thread 正在运行的语音服务立即停止 | AbortSignal 是取消传播机制，不能直接宣称上游服务确认终止；要核验实际provider接收与关闭行为 |
| 人物 | Cubism WebSDK Live2D，模型信息与加载Hook可复用；首版 kelaita 适配直接相关 | Live2D 与 VRM；stage-ui-live2d 通过 Pixi、pixi-live2d-display、Pinia与多个workspace包运行 |
| 口型 | use-audio-task 用 wav handler RMS 振幅驱动；已见源码不提供音素/viseme时间戳保证 | 有音频/renderer扩展，但本轮未证明任何具体TTS拥有口型时间戳 |
| 校园界面 | 原React界面可重做布局，保留renderer/语音链；知识、建筑校验、事件、回执均须薄扩展 | Vue UI可高度改造，现有服务更复杂；校园业务同样不能声称现成 |
| Windows成本 | requires-python >=3.10,<3.13，因此本机默认3.13不兼容，应选已安装3.11；uv尚缺。依赖含torch、sherpa、onnxruntime、多云SDK，安装量非轻量；保留uv.lock，不粗暴删依赖 | 根指定pnpm@11.24.0，本机尚无pnpm；catalog/patches/内部workspace与postinstall build。完整backend compose含PG、Redis、auth、Caddy；单web可pnpm dev，但完整自有后端不是零成本 |
| 稳定性 | README明确v2完全重写仍在规划、v1继续修bug；冻结版本后适合受控二开，但不应当成长期无变化底座 | 当前0.12.0-beta.5且大仓多app演进；内部包private，不能当稳定独立npm SDK；有音频单元测试文件，但本次未执行 |

版本数字是清单约束，不是本机安装解析结果。

## 3. 暂定主路线与备选

暂定主路线：完整二开 Open-LLM-VTuber 1.2.1 的 web 模式，保留 FastAPI + React/Vite，使用 kelaita 的独立 Live2D manifest/AvatarAdapter。应用产品是数字人校园导游；不启用桌宠应用定位，不由素材决定整个技术框架。主控完成提示词包读取后再冻结。

理由：现有前后端语音、打断、WebSocket、OpenAI兼容后端、Live2D运行链可真正复用；本机可用Python3.11；比AIRI完整后端与workspace改造的初始装配成本低。保留既有`/client-ws`，按现有type消息加request/session/event/cancel/scene ack薄适配，不额外造第二条不兼容聊天协议。新增health/knowledge等HTTP端点可独立装配。用户指定GLM必须全部通过自有后端，不能把真实key放前端设置。

备选路线：完整AIRI stage-web + 其后端，保留Vue，不移植到React。仅在OLV前端许可不满足项目用途，或需要已确认的VRM/复杂音频pipeline、并能承担pnpm workspace与backend配置成本时采用。本轮首版kelaita为Live2D，没有VRM/GLB证据，TalkingHead/three-vrm不深入。

组件组合并非目前首选：只搬OLV hooks仍依赖多个context、audioManager、task queue、Cubism SDK；只抽AIRI stage-ui-live2d仍依赖内部stage-shared/UI/model-driver、catalog与patch。重新拼整套会增加协议/状态所有权与取消集成工作。若采用组合，必须明确引入成熟依赖或保留带许可证的源模块，不能把“参考思路”计成复用。

用户最新补充允许在许可不一致时自行解决适配问题，因此增加可执行备选：保留OLV MIT后端及现有WebSocket协议，前端独立实现导游UI和适配器，不复制受额外条款约束的OLV-Web hooks/组件；经独立许可与版本审查后直接依赖成熟Live2D renderer和VAD/音频组件。主控正在核验pixi-live2d-display与VAD，本报告不提前替它们作许可或安装结论。也可带MIT原文适配AIRI音频pipeline源码，但须承认private/workspace依赖整理和状态/取消接线工作。该路线是代码独立实现与明确依赖组合，不是靠改名消除原前端许可证；Cubism运行时与kelaita素材许可仍单独适用。真实代价包括重新接麦克风、音频队列、RMS口型、取消回执和唯一状态所有者，并重新做端到端验证。最终是否提升为主路线由主控在必读提示词包到齐后决定。

主控后续核验证据补录（由主控读取官方源码及registry并传回，本子任务未重复读取）：`pixi-live2d-display@0.4.0` 的 [v0.4.0 LICENSE](https://raw.githubusercontent.com/guansss/pixi-live2d-display/v0.4.0/LICENSE) 为MIT，[package.json](https://raw.githubusercontent.com/guansss/pixi-live2d-display/v0.4.0/package.json) 指定Pixi 6系列peer并导出`/cubism4`；仍需外部Cubism Core且不可统称MIT。`@ricky0123/vad-web@0.0.31` 的 [LICENSE](https://raw.githubusercontent.com/ricky0123/vad/master/LICENSE) 含ISC与Silero ONNX MIT，[packages/web/package.json](https://raw.githubusercontent.com/ricky0123/vad/master/packages/web/package.json) 对应0.0.31，依赖onnxruntime-web ^1.17.0。此处VAD引用master与registry版本，尚未补固定commit。两者可作为备选直接依赖，但未安装/渲染验证。VAD仅检测语音活动，不等于ASR；播放队列、取消与会话控制仍需自行实现。

### 3.1 主控补充：组件组合已核验的直接依赖候选

用户已允许自行解决许可不一致引出的适配工作。主控随后实际读取官方 README、下列许可证和清单，并运行 `npm view ... version license dependencies peerDependencies --json`（仅查元数据，未安装）：

- `pixi-live2d-display@0.4.0`：[v0.4.0 LICENSE](https://github.com/guansss/pixi-live2d-display/blob/v0.4.0/LICENSE) 为 MIT；[该版本 package.json](https://github.com/guansss/pixi-live2d-display/blob/v0.4.0/package.json) 导出 `pixi-live2d-display/cubism4`、peer `@pixi/* ^6`，因此候选组合应使用 Pixi 6 而非盲装最新 Pixi。依赖清单另有 gh-pages。官方 README 说明 Cubism 4 支持 Cubism 3 模型，但仍须额外 Cubism Core；该 Core 的许可不能被此库 MIT 覆盖。kelaita 是否能由该组合正常渲染尚未实测。此处记录真实发布版本/标签，未额外声称核验其提交哈希。
- `@ricky0123/vad-web@0.0.31`：[官方 packages/web/package.json](https://github.com/ricky0123/vad/blob/master/packages/web/package.json) 与 registry 同为 0.0.31，依赖 `onnxruntime-web ^1.17.0`；[官方 LICENSE](https://github.com/ricky0123/vad/blob/master/LICENSE) 含库 ISC 及 Silero ONNX 模型 MIT。可直接复用麦克风活动检测；VAD 不是 ASR，文字转录仍需后端 ASR，TTS/播放队列/取消/回执也不会因此自动具备。master 文件是本次读取快照，未记录固定提交，冻结安装前应将所需文件及依赖解析纳入锁定。

这使“OLV MIT 后端与原 WebSocket + 独立校园前端 + 成熟 Live2D/VAD 依赖”成为具体可实施备选，减少对 OLV-Web 附加条件代码的依赖。是否采用完整原前端，或接受独立实现的集成成本，须结合缺失提示词包决定；本次尚未安装、导入源码、选定最终依赖锁或冻结主路线。上文“正在核验”的状态已由本段更新。

## 4. 直接复用/扩展清单（均已实际读取）

OLV后端固定提交链接前缀：`https://github.com/Open-LLM-VTuber/Open-LLM-VTuber/blob/992309c0aa19845960228f880013d4685fde93b5/`

- `src/open_llm_vtuber/agent/stateless_llm/openai_compatible_llm.py`：AsyncOpenAI/model/base_url/key/system 与流式结果；C扩展模型日志/历史边界；须关闭/脱敏原debug messages日志。
- `src/open_llm_vtuber/asr/asr_interface.py`：ASR抽象与音频格式；B封装前端start/stop和转录回调。
- `src/open_llm_vtuber/tts/tts_interface.py`：TTS音频文件抽象；B补音色列表/取消/回调语义，不能宣称现有接口已完整满足SpeechAdapter。
- `src/open_llm_vtuber/conversations/conversation_handler.py`：异步会话任务和打断；M装配C/B边界。
- `src/open_llm_vtuber/websocket_handler.py`：既有text-input、mic-audio-data/end、interrupt-signal、audio-play-start、history消息分发；M统一协议装配，不直接让A/B/C竞争编辑。
- `src/open_llm_vtuber/routes.py`、`src/open_llm_vtuber/server.py`：现有/client-ws与FastAPI入口、静态素材挂载；M独占共享入口。

OLV前端固定提交链接前缀：`https://github.com/Open-LLM-VTuber/Open-LLM-VTuber-Web/blob/d176e7df2366952e3bacbf12cf9a8b18a4315932/`

- `src/renderer/src/hooks/canvas/use-live2d-model.ts`：模型URL/配置和Cubism初始化；B包为renderer，禁止直接调用LLM。
- `src/renderer/src/hooks/utils/use-audio-task.ts`：音频任务、播放结束/错误、RMS口型；B适配能力声明。
- `src/renderer/src/hooks/utils/use-interrupt.ts`：停止音频与清队列；需把全局UI控制和B局部资源控制职责拆清楚。
- `src/renderer/src/services/websocket-service.tsx`：现有WebSocket薄适配落点（已读取文件保存，未全量验证类型）。

AIRI备选实际读过的核心路径：

- `packages/provider-inference/src/providers/cloud/openai-compatible/index.ts`：可配置provider，依赖xsai、zod、内部registry/validators。
- `packages/pipelines-audio/src/speech-pipeline.ts`、`src/managers/playback-manager.ts`：AbortSignal/TTS/playback协调，包自身private；不是已核验可npm独立安装的发布包。
- `packages/stage-ui-live2d/src/composables/live2d/live2d.ts`：Pinia模型动作设置；package.json导出renderer组件，但本次未深入renderer组件本体。
- `apps/stage-web/package.json`、`server/apps/api/package.json`、`server/docker-compose.yaml`：真实前后端和启动依赖。

## 5. 许可与素材边界（关键）

不能将完整OLV底座统一标MIT。

- [OLV后端LICENSE](https://github.com/Open-LLM-VTuber/Open-LLM-VTuber/blob/992309c0aa19845960228f880013d4685fde93b5/LICENSE)：MIT，版权所有者Yi-Ting Chiu 2025，样例人物明确例外。必须保留完整原文。
- [OLV前端LICENSE](https://github.com/Open-LLM-VTuber/Open-LLM-VTuber-Web/blob/d176e7df2366952e3bacbf12cf9a8b18a4315932/LICENSE)：Open-LLM-VTuber License 1.0，以Apache 2.0附加条件表达；文本允许教育/学术/非商业用途，付费托管、商业重品牌再分发、商业嵌入要求单独商业许可。不是纯Apache2.0或MIT。校园教育演示的暂定选型不构成未来收费发行授权。
- `src/renderer/WebSDK/Core/LICENSE.md`：Live2D Proprietary Software License；`Framework/LICENSE.md`：Live2D Open Software/SDK Release License相关条款，必须分别保留，不能以应用许可证覆盖。本次读了声明/链接，未做完整商业发行授权结论。
- [OLV LICENSE-Live2D.md](https://github.com/Open-LLM-VTuber/Open-LLM-VTuber/blob/992309c0aa19845960228f880013d4685fde93b5/LICENSE-Live2D.md)：已读样例数据条款相关部分，Shizuku有不得改名/设定等个别约束。不能把样例换名叫海小棠就视为自有资产。
- [AIRI LICENSE](https://github.com/moeru-ai/airi/blob/9f30a1977e09b3d68759492c5f8f775eb4502184/LICENSE)：MIT，Neko Ayaka 2024-PRESENT；不覆盖另有许可证的模型、第三方Live2D运行时与其他依赖。
- kelaita资源来自用户指定的本地目录，其作者、授权、可再分发/改名边界以素材盘点为准，本子任务未直接读其本地素材，不能声称授权已完备。kelaita的展示名/海小棠产品身份也需保留来源说明。

## 6. 审查证据清单与未验证能力

本目录有固定commit下载的README/LICENSE/清单、完整Git树JSON与上述源文件。下载后对README功能与开发段落、依赖清单、LICENSE、核心方法做了文本读取；大体积许可证只检索和读相关部分，不声称完整法律审查。未读取uv.lock/package-lock全部解析条目；仅由官方树确认它们存在（OLV后端uv.lock、前端package-lock；AIRI pnpm-lock）。

尚未验证：候选安装/构建/启动、Node24与前端工具链实际兼容、所列前后端提交配套、GLM网关/model/usage/工具调用、ASR硬件/模型、TTS音色、麦克风权限、无耳机回声与打断效果、上游取消确认、kelaita运行和资源授权、端到端口型同步、任何校园数据/建筑点位/知识版本/事件回执。

因此本报告不能作为BOOTSTRAP_READY或模型在线验证证据；主控应保留为暂定决策输入，等待必读提示词包再初始化及冻结协作。
