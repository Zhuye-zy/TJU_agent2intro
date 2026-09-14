# 珂莱塔数字人校园导游

基于 React/Vite、FastAPI、Live2D 与 LangGraph 的天津大学数字人导游工作台。第一版使用用户指定的 kelaita（珂莱塔）素材；应用形态是网页校园导游。

当前正在执行 M1：四个窗口已提交前端、人物语音、模型编排与校园知识，总控逐项审计、合并、联调并推送。合并后的真实能力以最终验收报告为准，分支测试不能代替集成验收。

安装（每个工作树独立）：

```powershell
.\scripts\Install.ps1
.\scripts\Copy-LocalAssets.ps1
```

开发启动（两个终端）：

```powershell
.\scripts\Start-Backend.ps1 -Port 8000 -EnvFile E:\AI4TJU\.env
.\scripts\Start-Frontend.ps1 -Port 5173 -ApiPort 8000
```

访问 http://127.0.0.1:5173 。模型请求全部经本机后端。密钥仅存在未跟踪的主目录 .env 或进程环境，不复制到工作树，不写入前端。

首次缺少配置时运行 `powershell -NoProfile -File E:\AI4TJU\scripts\Configure-Local.ps1`，在本机隐藏输入密钥。已有配置直接复用。

素材和 Cubism Core 依其独立许可本机准备，不随 GitHub 源码发布；克隆仓库后需提供有权使用的素材。保留原水印，Live2D 不等于三维模型；当前不承诺捏脸和准确中文口型。

阅读 [选型](docs/OPEN_SOURCE_DECISION.md)、[契约](docs/CONTRACTS.md)、[所有权](docs/OWNERSHIP.md)、[并行目录](docs/PARALLEL_RUN.md)、[许可证](THIRD_PARTY_NOTICES.md)、[集成记录](docs/M1_INTEGRATION.md)。
