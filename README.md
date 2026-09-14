# 珂莱塔校园导游

基于 React/Vite、FastAPI、Live2D 与 LangGraph 的天津大学数字人导游工作台。首版使用用户指定的 kelaita（珂莱塔）素材和角色语气，提供校园问答、内容生成、多轮聊天、资料来源与运行日志。

M1 已按 D→C→B→A 合并并推送。指定 **glm-5.1** 已通过真实一问一追问，校园检索、中文 TTS 合成和后端取消已实测。**BROWSER_QA_PENDING**：浏览器工具因无法可靠确认当前 URL 停止，合并后的画面、播放和输入法仍需本机现场体验；尚不声明 FRAMEWORK_CORE_PASS 或比赛全部通过。

## 在这台电脑上体验

当前应用地址：**http://127.0.0.1:8000**。主目录已有依赖、人物素材和未跟踪的模型配置；可直接打开此地址。

以后重新启动，在 PowerShell 执行：

```powershell
cd E:\AI4TJU
.\scripts\start-app.ps1
```

更新代码后运行 ` .\scripts\start-app.ps1 -Build ` 前，先停止已有实例：

```powershell
.\scripts\stop.ps1
.\scripts\start-app.ps1 -Build
```

脚本按自身目录定位项目，只监听 127.0.0.1，输出本项目 PID/端口。停止时核对 PID 和创建时间，不杀其他 node/python。若 PowerShell 阻止脚本，可对本次进程使用 `powershell -NoProfile -ExecutionPolicy Bypass -File E:\AI4TJU\scripts\start-app.ps1`，无需修改系统执行策略。

详细操作与检查步骤见 **[本地使用与测试指南](docs/USER_GUIDE.md)**。

## 建议先试这几项

1. 切到“普通聊天”，输入“你好，请介绍你的名字和导游职责”；再追问上一轮内容。
2. 切到“北洋园校区”，点击“郑东图书馆”下的“介绍这里”，展开回答下方的来源。
3. 请求处理中打开“运行日志”，应先看到 request/model 的 started，完成后出现 completed。
4. 点击回答下的“播放”或勾选“自动播报”；播放期间试“停止”。实际听音和人物 speaking 状态仍需你本机确认。
5. 生成一段较长内容后点“停止”，再重试或清空会话，检查没有迟到回复与旧音频。

## 安装、开发与接口检查

本机已经安装，不需要每次重复 setup。新环境必须先安装 Node >=22.12 与 Python 3.11，然后准备有权使用的本地素材：

```powershell
.\scripts\setup.ps1 -Python 'D:\Program Files\Python311\python.exe'
.\scripts\Configure-Local.ps1    # 仅在没有模型密钥时，本机隐藏输入
.\scripts\start-app.ps1 -Build
```

锁文件：npm `package-lock.json` 与 uv `uv.lock`；setup 使用 npm ci / uv sync --frozen。人物及 Cubism Core 不随 GitHub 源码发布，素材准备详见指南和许可记录。

开发模式：

```powershell
.\scripts\stop.ps1
.\scripts\start-dev.ps1
# 页面 http://127.0.0.1:5173；后端 http://127.0.0.1:8000
.\scripts\check-api.ps1
# 可选：真实调用一次指定 GLM
.\scripts\check-api.ps1 -Chat
```

所有模型请求由自有后端发送。密钥只在主目录被忽略的 .env 或进程环境，不放入前端、日志、报告、工作树或 GitHub。网关及模型保持用户指定值，不自动切换供应商。

## 已知范围

- 知识库：7 条有来源摘要、2 个北洋园建筑；关键词检索，坐标为 null。2017 年地图仅为历史资料。
- 形象：Live2D；缩放与背景是展示设置。没有三维、捏脸、皮肤/配饰系统、动作文件或准确口型。
- 语音：Edge TTS 查询到 14 个中文音色并生成真实音频；未使用珂莱塔克隆音色。ASR 缺少独立服务，中文识别未完成。
- 取消：本地任务可停止；已发出的 GLM/TTS 请求只报告上游停止 unconfirmed。
- 当前 HTTP 成功与测试通过不等于浏览器端全流程通过。

[统一验收报告](docs/FINAL_REPORT.md) · [实际开源复用](docs/OPEN_SOURCE_DECISION.md) · [接口契约](docs/CONTRACTS.md) · [协作目录](docs/PARALLEL_RUN.md) · [第三方许可](THIRD_PARTY_NOTICES.md) · [下一阶段](docs/NEXT_PHASE.md)
