# M0 协调记录

bootstrap基线为标签m0-bootstrap（7706f0c05b1854c676678a1f0704e6ae0295d616），四树均由该提交创建。

首次并行安装的日志已完成，但Windows PowerShell Start-Process返回的Process对象在WaitForExit后ExitCode为null，汇总把null当失败。这是主控安装回执缺陷。独立协调提交修复：
- Install.ps1在各自.runtime/install-result.json写入running/completed/failed和真实命令检查结果；
- Setup-Worktrees.ps1读取该明确回执，不再依赖失效的Process.ExitCode；
- 重用工作树时只允许干净且位于bootstrap或当前集成HEAD，拒绝覆盖用户分支进展；
- PARALLEL_RUN补充“共同bootstrap + 全体一致同步的协调提交”定位。

没有更改模型网关、业务实现、公共API字段或依赖锁。M0窗口尚未启动，主控先对四树执行git merge --ff-only integration/m0同步同一协调提交，再执行安装与验证。后续窗口已独立开发时必须按PARALLEL_RUN先提交自己的变更，再cherry-pick指定协调提交，不使用此批量fast-forward方式。

实际COORD_COMMIT和每树launch_commit由.runtime/parallel-state.json记录，所有工作树必须一致；m0-bootstrap标签不移动。安装、素材、虚拟环境和日志各自独立，根.env未复制。
