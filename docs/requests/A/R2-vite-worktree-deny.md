# A-R2 → M：Vite 工作树自身被 deny 阻断

## 复现

在 A 的规定工作树 `E:\AI4TJU\.worktrees\ui` 执行：

```powershell
.\scripts\Start-Frontend.ps1 -Port 5174 -ApiPort 8001
```

访问 `http://127.0.0.1:5174/` 返回 403，Vite 输出：

```text
The request id "E:/AI4TJU/.worktrees/ui/frontend/index.html" is outside of Vite serving allow list.
```

根因是 M 独占的 `vite.config.ts` 同时把当前 `frontend` 加入 `server.fs.allow`，又用 `server.fs.deny: ['**/.worktrees/**', ...]` 命中该文件的绝对路径；deny 优先于 allow。

## 请求

请 M 调整共享 Vite 配置，使各规定隔离工作树自身的 `frontend`、`shared` 可以访问，同时继续拒绝跨工作树扫描及 `.env/.runtime`。A 不越权修改 `vite.config.ts`。

