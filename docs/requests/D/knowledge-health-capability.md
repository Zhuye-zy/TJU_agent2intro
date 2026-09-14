# D 请求：将 health 的 knowledge capability 接到真实状态

`backend/knowledge/service.py` 在 D 工作树已加载本地、无网络的真实资料库并提供冻结的 status/search/building 路由。`backend/app.py` 仍固定返回 `capabilities.knowledge=false`，所以成功运行知识库时 health 不能反映实际能力。

请 M 在装配层以 `backend.knowledge.service.knowledge.get_status().status == "ready"` 设置 health 的 `knowledge` 值，并相应更新 M 所有的基线空知识断言。无需更改 1.0.0 契约或增加依赖。
