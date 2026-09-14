# B → M：修正 Vite 开发服务器 fs.allow 绝对路径

## 阻塞

`scripts/Start-Frontend.ps1 -Port 5175 -ApiPort 8002` 启动成功，但请求根目录内的
`frontend/src/avatar/probe.html` 返回 403。Vite 报告实际 allow list 被解析成：

- `E:/AI4TJU/.worktrees/avatar/frontend/frontend`
- `E:/AI4TJU/.worktrees/avatar/frontend/shared`

当前 `vite.config.ts` 设置 `root: 'frontend'`，同时 `server.fs.allow` 使用相对值
`['frontend', 'shared']`，Vite 8 将它们相对已解析的 root 再次解析。正式开发页的模块请求也受此影响。

## 最小请求

请由 M 将 `vite.config.ts` 的 allow 项改为项目根派生的绝对路径（`frontend`、`shared`），
或删除显式 allow 并使用 Vite 的 workspace root 自动判定；保留 `.env/.worktrees/.runtime` deny。
不需要新增依赖、契约字段或锁文件变更。

## B 可继续部分

B 已用 B 路径内的临时配置完成独立浏览器验收并删除临时文件，没有修改共享配置；
人物、语音、单测和生产构建不受此问题阻塞。
