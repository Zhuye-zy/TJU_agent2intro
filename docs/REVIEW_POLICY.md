# 推送与合并审核规则

仓库所有者和唯一指定审核人：**@xxwan320**。

保护范围：默认分支（当前 integration/m0）、integration/**，以及以后可能使用的 main/master。work/** 和其他功能分支保持正常提交方式；没有写权限的外部贡献者使用 fork。

贡献流程：

1. 在自己的功能分支提交并 push，不直接更新受保护集成分支。
2. 创建以 integration/m0 为 base 的 Pull Request。
3. @xxwan320 阅读 Files changed 和测试结果，通过 Review changes → Approve 批准；需要修改则 Request changes。
4. 新的可审核提交会使旧批准失效，应再次审查。
5. 最终由 @xxwan320 决定并点击合并。其他人即使已经获得批准，也不能自己更新受保护分支。

实现包含 .github/CODEOWNERS（所有文件仅指定 @xxwan320）与 GitHub 服务端 branch ruleset。规则定义存放在 .github/repository-ruleset.json；单独提交这个 JSON 不会启用远端保护，实际生效结果见文末核验记录。

服务端规则要求 PR、至少 1 份批准、代码所有者审核、处理完 review conversation。update 限制使其他账户不能直接 push 或自己合并；删除/强推也受限制。没有给 GitHub App、团队、普通写权限或整个管理员角色设置绕过。

仅 @xxwan320 账户保留 always bypass，满足“除了我以外”的例外：你自己的提交无需自己批准，也仍可直接更新。你的账户手动选择绕过时可以合并，这是所有者最终决定权。使用你账户的 token、Git 凭据或自动代理也会被 GitHub 视为你本人，因此不要把所有者凭据共享给协作者。

本项目代理处理他人后续 PR 时，不能因为持有所有者凭据就自动批准/绕过；需要你对该 PR 的明确合并指令。配置此规则不代表批准任何现存或将来的 PR。

自动合并当前关闭。没有新增付费功能、修改仓库可见性或移除协作者。

## 已核验生效

2026-09-14 已通过所有者身份的 GitHub API 回读：
- ruleset **23284148**，enforcement=active：[查看规则](https://github.com/xxwan320/TJU_agent2intro/rules/23284148)。
- 唯一 bypass actor 为 User 183117732（xxwan320），模式 always；没有管理员角色/App/团队例外。
- integration/m0 实际匹配 update、pull_request、deletion、non_fast_forward；main 也匹配。
- work/ui 无匹配保护规则，工作分支保持可提交；其他工作分支同属不匹配范围。
- CODEOWNERS errors=[]，自动合并仍关闭。
- 个人仓库 API 未回读独立的 review dismissal 限制，因此未把它计作启用功能；其他人仍无法更新或合并受保护分支。

核验数据：REVIEW_POLICY_VERIFICATION.json。没有借用其他账户、执行破坏性推送或创建假 PR 来测试。规则以 GitHub 当前设置为准；本地文件用于审计与维护。
