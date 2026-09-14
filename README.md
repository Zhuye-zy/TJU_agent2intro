# 海小棠数字人校园导游

M0：可运行工程骨架，首版形象kelaita（Live2D）。这是校园导游应用，不是桌宠。真实对话、知识、语音及renderer实现由A/B/C/D并行完成。

安装（每个工作树独立）：

```powershell
.\scripts\Install.ps1
.\scripts\Copy-LocalAssets.ps1
```

主目录两个终端启动：

```powershell
.\scripts\Start-Backend.ps1 -Port 8000
.\scripts\Start-Frontend.ps1 -Port 5173 -ApiPort 8000
```

访问 http://127.0.0.1:5173 。模型未实现时“检查接口”返回501并展示真实request日志，这不是模型成功。所有模型请求经本机后端；不在前端配置密钥。

只由M/C在主目录执行一次隐藏输入：
`powershell -NoProfile -File E:\AI4TJU\scripts\Configure-Local.ps1`。
之后显式 `.\scripts\Start-Backend.ps1 -EnvFile E:\AI4TJU\.env`。A/B/D无需密钥；不复制.env。现有进程CAMPUS_*配置优先。首次真实GLM验证由C实施。

验证：
```powershell
npm run build
node scripts/check-adapters.mjs
.\.venv\Scripts\python.exe -m pytest -q
```

M0基线测试包括stub诚实性；C接入模型后如需改变共享测试，由M协调，不擅改契约。当前LangGraph节点仅返回not_implemented，未配置云追踪或检查点；SDK构造不发请求。

阅读 [选型](docs/OPEN_SOURCE_DECISION.md)、[契约](docs/CONTRACTS.md)、[所有权](docs/OWNERSHIP.md)、[并行启动](docs/PARALLEL_RUN.md)、[许可证](THIRD_PARTY_NOTICES.md)、[未验证项](docs/M0_VERIFICATION.md)。
