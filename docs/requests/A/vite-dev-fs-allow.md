# A → M：Vite 开发服务器根页面 403

## 阻塞

按统一命令 `./scripts/Start-Frontend.ps1 -Port 5174 -ApiPort 8001` 启动后，访问 `http://127.0.0.1:5174/` 返回 403。Vite 输出：

```text
The request id "E:/AI4TJU/.worktrees/ui/frontend/index.html" is outside of Vite serving allow list.
- E:/AI4TJU/.worktrees/ui/frontend/frontend
- E:/AI4TJU/.worktrees/ui/frontend/shared
```

## 原因与所需共享改动

`vite.config.ts` 设了 `root: 'frontend'`，但 `server.fs.allow: ['frontend', 'shared']` 被 Vite 相对该 root 解析，形成不存在的 `frontend/frontend` 与 `frontend/shared`。该文件归 M 独占，请 M 将 allow 项改为从配置文件位置解析的真实绝对路径，或使用 Vite 的工作区根搜索辅助函数，并复验嵌套 `.worktrees` 仍被拒绝。

涉及公共文件：`vite.config.ts`。不需要新依赖或锁文件变更。

## A 可继续部分

A 的 `npm run typecheck`、`node --test tests/ui/model.test.ts` 和 `npm run build` 均可独立完成。生产构建产物正常；在 M 协调修复前，统一开发命令的浏览器布局/输入验收标记为未完成，不以静态 fixture 冒充集成通过。
