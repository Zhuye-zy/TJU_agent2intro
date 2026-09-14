# M1 统一验收报告

日期：2026-09-14。主目录 E:\AI4TJU，分支 integration/m0。
结论：**接口核心已通过真实验证，BROWSER_QA_PENDING**。尚不标记 FRAMEWORK_CORE_PASS：合并版本人物的现场可视与音频播放检查被浏览器工具阻断。完整比赛验收未完成。

## 集成与环境

用户明确确认 A/B/C/D 均停止修改后，重新核对四个工作树干净、提交未变化，按 D→C→B→A 顺序合并；保留全部来源提交，没有重复 cherry-pick、强推、目录重置或删除工作树。
B 推送时远端新增 README 标题修改 1b07934，通过 290645b 正常合并保留“珂莱塔校园导游”。

|窗口|工作树|分支|交接提交|集成提交|
|---|---|---|---|---|
|D|E:\AI4TJU\.worktrees\knowledge|work/knowledge|9009033|71bc9dc|
|C|E:\AI4TJU\.worktrees\api|work/api|12d877f|d0f6404|
|B|E:\AI4TJU\.worktrees\avatar|work/avatar|6150e5b|5ecc4df|
|A|E:\AI4TJU\.worktrees\ui|work/ui|4ca7bcf|1715664|

共同基线 7706f0c05b1854c676678a1f0704e6ae0295d616（不可移动 m0-bootstrap）。
代码/资源验收基准 d4931b88db7df61c0afb721c693a4725a430309a；之后交付文档与脚本修正见本报告所在提交的 Git 历史。最终交付哈希在总控消息输出，可用 git rev-parse HEAD 核对，不为把提交自身哈希写回报告而循环提交。

Windows；Node 24.19.0 / npm 12.0.2 / Python 3.11.9 / uv 0.12.13。主目录与四工作树依赖、虚拟环境和日志独立。M1 使用 npm ci、uv sync --frozen --link-mode copy 重装；package-lock.json 与 uv.lock 相对 M0 未变化。
安装中 protobufjs 的 postinstall 被 npm 现有策略阻止；未绕过策略，当前构建和适配器打包均成功。pytest 有 1 条依赖弃用警告，没有测试失败。

## 验收矩阵

PASS 指本行列明的范围，不代表相邻未测能力通过。

|项目|状态|证据与限制|
|---|---|---|
|开源组件实际复用|PASS|保留 React/Vite + FastAPI 组件组合，实际入口与版本见下表和 OPEN_SOURCE_DECISION；没有移植 AIRI/OLV 全应用。|
|珂莱塔名称与人设|PASS|7e54a0b 统一当前项目文本；backend/model/persona.py 参考本机角色设定，系统事实规则仍由后端控制；品牌单字也改为珂。|
|人物素材身份/相对路径|PASS|9 个文件、Cubism Core 与源目录/归档/项目/构建哈希一致，开发与构建模式 HTTP 200；运行不读取桌面源目录。B 清单 cdi3 哈希笔误已据实修正。|
|合并版本人物可视展示|BLOCKED|B 分支报告已渲染；M1 浏览器工具因不能可靠确认当前 URL 自动停止。HTTP/打包不替代现场画面，未制造截图。|
|展示缩放/背景|BLOCKED|接口/界面已实现，真实浏览器交互待验证；不是捏脸。|
|皮肤、配饰、几何捏脸、三维形象|NOT_IMPLEMENTED|当前 Live2D 无可用系统；lip_sync=none，motions/expressions=[]，无准确口型或克隆音色。|
|GLM 首问与追问|PASS|合并后指定 glm-5.1 返回 200；追问正确复述随机临时标记，供应商 usage 实值，详下表。|
|请求中的真实日志|PASS|两个普通聊天及建筑问答在返回前均已观察到 request started；随后 model/request completed。取消单独为 cancelled。|
|前后端事件边界|PASS|31 项 Python 测试包含客户端不能声称 model 成功、事件去重、伪造/重复回执、取消与历史限制。真实 API 未发送虚假场景成功回执。|
|日志界面、实际人物/播报事件联动|BLOCKED|前端已接 onplaying/onended 和分源事件，补齐终态轮询与取消刷新；需要实际浏览器确认。|
|中文 TTS 音色查询|PASS|真实查询 14 个中文音色；默认测试 edge:zh-CN-XiaoxiaoNeural。|
|中文 TTS 合成与取回|PASS|HTTP 200，39,456 字节 audio/mpeg，6,361ms；一次性 URL 第二次取回 404；timestamps=none。不等于本机已听到声音。|
|TTS 服务端打断|PASS|真实合成中 stop 返回 200/local_stopped=true，合成返回 499/stopped；上游 unconfirmed。|
|浏览器可听播放/音色听感/播放中断|BLOCKED|M1 UI 工具停止。2 项隔离音频测试验证 abort 停止与迟到回调抑制，但不冒充实际扬声器测试。|
|中文识别|BLOCKED|缺独立 ASR URL/model/key；实际返回 503/asr_not_configured。生成静音请求只验证缺配置错误，不计为中文转录。|
|知识命中与来源|PASS|sha256:e7d1329b9b4c，7 条摘要/2 个北洋园点位；郑东图书馆真实命中及引用官方页面。|
|未收录资料|PASS|不含已录关键词查询返回 sources=[]、model=local-workflow、usage=null；不虚构模型成功。关键词部分匹配可能仍返回相关资料，覆盖有限。|
|建筑校区/白名单动作|PASS|真实回答发布 show_building_card，ID=beiyangyuan-zhengdong-library；伪造 action_id 为 404，重复 chat request_id 为 409；跨校区等由测试验证。|
|场景客户端执行回执|BLOCKED|前端在 DOM 更新且资料卡存在后才 ack；实际 UI 执行未验证，不把 scene started 记成 completed。|
|真实聊天取消|PASS|model started 后取消，HTTP 499，request cancelled；local_task_stopped 最初可为 false，upstream_stop=unconfirmed。|
|超时、失败、迟到回复、历史限制|PASS|隔离测试覆盖认证/网络/限流/超时/非 JSON/空答案/来源伪造/模型名不匹配/吞掉取消的适配器；失败取消不提交历史，mock 不更新正常 health。不是故意破坏真实网关来测失败。|
|清空/重试/旧音频前端全流程|BLOCKED|代次与会话守卫、旧音频取消及隔离测试通过；真实浏览器全流程待补。|
|桌面/小屏/输入法/错误空状态视觉|BLOCKED|构建通过、响应式及 composition 逻辑存在；缺现场交互和截图，详 USER_GUIDE 最短手工流程。|
|开发代理/生产同源|PASS|11 项 HTTP 检查；开发 /src/main.tsx 与 /api 可用；生产页面/接口/资产可用；.env、嵌套工作树访问被拒绝。|
|密钥与导出|PASS|主 .env 配置存在，未追踪；扫描已审计 17 个可达提交/189 个唯一 blob 高置信模式和实际配置密钥，匹配 0。前端源码/构建实际密钥匹配 0；日志导出删 request/event/action 原始标识。|
|FRAMEWORK_CORE_PASS|BLOCKED|尚缺合并后人物可视展示验证；附 BROWSER_QA_PENDING。|
|全部比赛要求|NOT_IMPLEMENTED|3D 校园、真正定制、专业语音及参赛项仍需下一阶段。|

## 真实模型证据

来源：docs/evidence/live-api.json。标识使用本次测试别名，未保存原始 request/session ID、测试标记、原始回复、认证头或隐藏推理。

|脱敏 request 别名|模型|HTTP|后端耗时 ms|prompt / completion / total tokens|结果|
|---|---|---:|---:|---|---|
|glm-first|glm-5.1|200|19000|370 / 586 / 956|非空真实回答|
|glm-followup|glm-5.1|200|8922|414 / 386 / 800|复述临时标记正确|
|campus-building|glm-5.1|200|16406|647 / 875 / 1522|郑东图书馆来源与已发布卡片动作|

上述用量直接来自供应商，不自行估算；它可能包含供应商计入的推理 token，本应用不请求或记录隐藏思维链。空检索本地不足说明不伪装成 GLM 回答。

## 直接复用与总控改动

|实际包/版本|实际调用文件/成熟部分|自己的适配|
|---|---|---|
|React/React DOM 19.3.0；Vite 8.3.0；TS 5.9.3|frontend/src/main.tsx、ui/App.tsx、vite.config.ts|导游工作台、同源传输、响应式布局、角色与请求状态；修复 Vite fs.allow 路径。|
|PixiJS 6.5.10 + pixi-live2d-display 0.4.0|frontend/src/avatar/adapter.ts：Application、Live2DModel.from、Ticker|独立 kelaita manifest、resize/dispose、眨眼和参数姿态；没有直接复制 OLV UI。|
|Cubism Core 固定 OLV-Web d176e7d 源文件|本机 /vendor/live2dcubismcore.min.js，SHA 94278358…2fcff7c|保留版权头和独立专有许可；不提交原件。|
|vad-web 0.0.31 / ONNX runtime|frontend/src/speech/adapter.ts：MicVAD|PCM16 WAV 采集、独立 ASR 端点和中止；VAD 不是识别器。|
|OpenAI Python SDK 3.13.0|backend/model/service.py：AsyncOpenAI.chat.completions.create|指定网关只去掉一次 /chat/completions；stream=false/max_retries=0；模型名校验、错误映射、有限历史。|
|edge-tts 7.2.8|backend/speech/service.py：list_voices、Communicate.save|独立语音注册/取消、同源一次性音频和容量/失效控制。|
|LangGraph 1.2.11|backend/model/service.py：StateGraph.compile/ainvoke|intent→retrieval→answer→scene_action 固定流程，不宣称 GLM 原生 tools。|
|FastAPI 0.141.1 / Uvicorn 0.52.4 / Pydantic|backend/app.py、各领域 routes、contracts|限长、脱敏错误、健康装配、构建后同源资源服务。|

OLV 1.2.1/992309c、AIRI 0.12.0-beta.5/9f30a19、FastAPI full-stack 模板仅设计参考；TalkingHead/three-vrm 未采用。具体完整 SHA、README/依赖/少量源码审查和原许可证见 OPEN_SOURCE_DECISION、THIRD_PARTY_NOTICES、docs/research 和 docs/licenses。没有将“读过 README”计作源码复用。

## 验证命令与证据

- 主目录锁文件安装：scripts/Install.ps1，完成；本机 .runtime/install-result.json 为 completed/0。
- npm run build：通过，Vite 132 模块；node scripts/check-adapters.mjs：人物/语音独立打包通过。
- python -m pytest -q：31 passed；node --test tests/ui/model.test.ts tests/speech/adapter.test.mjs：9 passed。
- scripts/verify-live.py：真实 GLM/知识/事件/取消/TTS，脱敏记录 docs/evidence/live-api.json。
- docs/evidence/technical-checks.json：开发/生产 HTTP、9 文件哈希、独立 Core、锁文件和秘密扫描。
- docs/evidence/BROWSER_QA.md：工具停止原因与未完成项；本轮没有截图文件。API 检查通过不代表视觉或播放通过。

当前仅主目录构建版本保持运行，URL http://127.0.0.1:8000；前端、后端同源。临时 Vite 验收进程已停止，四个工作树保留。运行日志/音频继续位于忽略的 .runtime，根 .env 未复制或推送。

## 用户交付

按 README 和 docs/USER_GUIDE.md 可立即在本机体验。优先补人物展示、中文输入法、实际播放/停止以及小屏截图，再配置独立 ASR。其余专业语音同步、真实形象定制、3D 场景/地图和比赛测试保留在 NEXT_PHASE.md。
