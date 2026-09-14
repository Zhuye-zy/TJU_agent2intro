# M0 验证与能力边界

日期：2026-09-14。这是工程骨架验收，不是A/B/C/D业务验收。

## 已实测通过

- Node24.19.0/npm12.0.2，独立Python3.11.9；uv0.12.13位于项目.tools。
- npm安装149个包，uv锁解析63项目/包项并安装62依赖；两个锁文件保留。Pixi6.5.10/pixi-live2d-display0.4.0、vad-web0.0.31、OpenAI3.13.0、edge-tts7.2.8、LangGraph1.2.11已安装。
- npm run build：TypeScript类型检查通过；Vite8.3.0转换130模块，生产JS约224.8kB（gzip约71.1kB），CSS约1.52kB。
- node scripts/check-adapters.mjs：113模块构建成功，实际产出Cubism4、Pixi和VAD依赖包；这不代表实际渲染/麦克风已经工作。
- .venv/Scripts/python -m pytest -q：5 passed。包含真实stub的501、request started/failed事件、输入不进日志、重复ID409、未知建筑拒绝、伪造动作回执拒绝、客户端冒称model事件拒绝、前端事件去重冲突、真实空知识状态、请求体限制、已发布动作的幂等回执以及日志容量截断、运行中取消后上游仍为unconfirmed。唯一假建筑仅在隔离测试monkeypatch。
- LangGraph StateGraph实际compile并invoke，返回status=not_implemented；不返回预设答案。
- 所有PowerShell脚本通过Parser语法检查；隐藏密钥输入脚本没有实际输入/配置密钥。
- 主应用实际在线：http://127.0.0.1:5173，API http://127.0.0.1:8000，仅本机监听。进程启动器PID与端口记录.runtime/processes.json，实际监听PID可由Get-NetTCPConnection核验（Python启动器可能另有子进程）。
- scripts/verify-live.py经Vite同源代理实测：主页200、health200、knowledge status200、kelaita manifest200、Cubism Core200、VAD模型200；POST chat真实501，轮询得到该请求真实started/failed；speech stop为not_started。
- 原始本机证据保存在.runtime/live-smoke.json、.runtime/logs/；均忽略，不含密钥/完整输入。四窗口创建和独立安装后由.runtime/parallel-state.json记录，不把尚未执行的分支业务标为完成。

## 有限性与依赖提示

- npm提示pixi-live2d-display的gh-pages传递依赖包含deprecated glob/inflight；当前按兼容Pixi6锁定，并未声称生产安全审计完成。
- npm12默认阻止protobufjs的postinstall；未擅自全局放开安装脚本。当前类型/应用/适配器构建通过，但VAD浏览器运行仍须B验证。
- pytest有Starlette对anyio BlockingPortal别名的弃用警告；测试通过，未为消除警告升级或改写第三方依赖。
- 本轮浏览器工具返回“No browser is available”，因此未进行浏览器视觉/交互验收；HTTP、资源与编译证据不能代替浏览器端到端验收。

## 明确未完成 / 归属

|能力|当前状态|后续窗口|
|---|---|---|
|精美可用导游工作台、对话/来源/日志体验|仅M0接口检查页面|A|
|kelaita实际渲染、缩放/背景、RMS嘴形|资源和运行依赖准备好，renderer stub|B|
|麦克风/ASR服务/真实转录/语音播放和打断|VAD/SDK/Edge TTS依赖与stop接口stub；无服务验证|B|
|指定GLM真实非流式、usage、错误/重试、历史|model stub；configured=false、verified=false|C|
|固定知识工作流、工具调用/上游停止确认|仅LangGraph可编译stub，不证明tools或取消确认|C|
|真实知识、来源与建筑点位|unavailable，0文档/0建筑，version=null|D|
|2D白名单动作执行|仅发布/回执接口及隔离测试，正常数据无动作|A/C/D|
|3D校园、捏脸、照片级/音素级中文口型|未实现，不展示假可用按钮|后续|
|人物/克隆音色对外再分发授权|保留来源但未核验；未加载克隆音色|后续|

根.env未创建；指定密钥配置false。通用OPENAI_API_KEY未用于本项目。用户可用scripts/Configure-Local.ps1一次隐藏输入，M/C显式读取，四工作树不复制.env。M0完成后等待四窗口，未提前做业务或执行M1。
