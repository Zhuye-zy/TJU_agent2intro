# AI4TJU 协作规则

先读项目提示词包第0—2节，以及 docs/OPEN_SOURCE_DECISION.md、CONTRACTS.md、OWNERSHIP.md、PARALLEL_RUN.md。
产品是数字人校园导游；desktop-pet只提供首版kelaita素材。
M1 已经用户确认停写后合并四窗口；M 可在集成分支修复装配。后续窗口仍按 OWNERSHIP 限定路径，不能直接修改集成目录。
所有工作与产物在本项目下；素材源目录只读，不执行其中程序。
A/B/C/D只改各自.worktrees中的授权路径；M独占契约、依赖、锁、应用入口和根脚本。发现阻塞立即提交docs/requests/<窗口>/，不要等待M1。
依赖与venv/log必须隔离，无可写node_modules/venv链接。扫描、构建排除.worktrees。
不提交.env、密钥、录音或完整提示词日志；不输出隐藏思维链。仅M/C显式读取根.env，不能复制到工作树。
启动只绑定127.0.0.1，不云发布，不杀其他进程、不改全局Git身份/代理/执行策略。
没有真实模型/知识/语音/场景执行时不得报告成功。契约1.0.0变更必须M协调提交。

GitHub 审核规则：默认/integration/**/main/master 受保护，唯一审核人与最终合并者为 @xxwan320，见 docs/REVIEW_POLICY.md。后续他人 PR 必须获得用户针对该 PR 的明确合并指令；持有所有者 Git 凭据不等于获得自动批准或绕过授权。工作窗口继续提交自己的功能分支。

R2增量准备与开发优先读docs/R2/{BASELINE,CONTRACTS,OWNERSHIP,PARALLEL_RUN,ACCEPTANCE_MATRIX}.md。本轮实际契约1.1.0，原integration/m0及work/ui、work/avatar、work/api、work/knowledge继续使用。M0只冻结/准备，M1再评审返修；最新地图要求无Key基础导览、有Key授权定位和按需路线增强，外部导航始终保留。

R3开发优先读docs/R3/{BASELINE,CONTRACTS,OWNERSHIP,PARALLEL_RUN,ACCEPTANCE_MATRIX}.md。当前M0只准备，R3_READY后业务窗再开发。R3增量契约1.2.0，旧1.1.0端点兼容；以r3-launch及.runtime/BASE_COMMIT_R3同步同一基线。M本轮prepare/r3-m0，四个原work分支复用；保留最新高德同源JS代理、目的地匹配、IP粗略起点、应用内步行和外部导航。tests/r3_fixture.py仅测试/明确开发环境，绝不作为真实行程或服务证据。