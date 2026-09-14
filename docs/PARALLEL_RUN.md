# 四窗口启动与共同基线

M0主目录：E:\AI4TJU，集成分支integration/m0。没有云远程，不发布。

BASE_COMMIT为轻量标签 **m0-bootstrap** 所指的完整提交。标签只创建一次、禁止移动。每个工作树的.runtime/BASE_COMMIT保存实际40位哈希；运行 `git rev-parse refs/tags/m0-bootstrap` 可核验。Git提交不能在自身跟踪文件内包含自己的最终哈希，故用不可移动标签及本机生成记录精确定位；四个工作树必须同指该提交，不能从各自不同HEAD启动。

|窗口|绝对目录|分支|前端/后端端口|
|---|---|---|---|
|M|E:\AI4TJU|integration/m0|5173 / 8000|
|A|E:\AI4TJU\.worktrees\ui|work/ui|5174 / 8001|
|B|E:\AI4TJU\.worktrees\avatar|work/avatar|5175 / 8002|
|C|E:\AI4TJU\.worktrees\api|work/api|5176 / 8003|
|D|E:\AI4TJU\.worktrees\knowledge|work/knowledge|5177 / 8004|

M0实际创建与安装记录位于主目录.runtime/parallel-state.json。端口是各工作树专用分配，M0只保持主应用运行，其他窗口启动前仍须查占用；有冲突通知M，不能杀别的进程。

## 安装与运行

每个工作树已有相同锁文件；node_modules、.venv、.tools、.runtime均为独立普通目录，无可写链接。初装/重装：
```powershell
.\scripts\Install.ps1
.\scripts\Copy-LocalAssets.ps1
```
Install使用Python3.11.9默认路径、项目.tools下uv0.12.13、uv sync --frozen --link-mode copy和npm ci。仅复用正常下载缓存。不能各自npm install加包或uv lock改锁；正常npm ci/uv sync --frozen不改锁。

在自己工作树两个终端按表启动，例如A：
```powershell
.\scripts\Start-Backend.ps1 -Port 8001
.\scripts\Start-Frontend.ps1 -Port 5174 -ApiPort 8001
```

只M/C按需显式传-EnvFile E:\AI4TJU\.env，或设置进程AI4TJU_ENV_FILE。根.env不会复制/自动继承。A/B/D不用模型密钥。缺密钥时由M/C一次执行主目录scripts/Configure-Local.ps1隐藏输入，不发到聊天。实际GLM普通非流式验证归C，不能把M0 health当成功。

素材源只读；主目录.runtime/asset-source持有选定kelaita与Core，工作树复制自己的public资源，资源/依赖不通过可写链接共享。任何新资产先记录来源，不能提交未核验的角色或音色包。

## 所有权与共享边界

严格按OWNERSHIP。A管应用交互状态/显示，B管局部renderer/音频资源；C唯一拥有用于模型的历史与系统提示，D返回真实建筑ID和知识。公共入口、shared/**、backend/contracts.py、backend/common/**、依赖/锁/配置/脚本全部M独占。M0 stub实际实现立即归各窗口，不等M代做。

## 阻塞与协调提交

窗口发现依赖/契约问题立即提交docs/requests/<窗口>/<主题>.md，至少包含：所需包/版本或字段、真实报错、涉及公共文件、可继续的独立工作。提交自己路径的变更后，把提交号通知M。

M检查并以独立协调提交修改公共文件，给出COORD_COMMIT及同步命令。窗口先提交或妥善保存自己的变更，暂停相关共享接口使用，然后在自己的工作树执行：
```powershell
git cherry-pick <M提供的COORD_COMMIT>
.\scripts\Install.ps1
```
记录已同步协调提交，禁止反复cherry-pick同一提交。冲突停下通知M，不重置用户修改。若M暂不协调，继续独立工作并PARTIAL交接，不能等M1才报告。

## 一句话启动指令

- A：在E:\AI4TJU\.worktrees\ui读取AGENTS和冻结文档，实现A路径内导游工作台、对话/来源/日志及2D场景执行，禁止改B状态和共享文件。
- B：在E:\AI4TJU\.worktrees\avatar读取冻结文档，实现kelaita AvatarAdapter、独立ASR/TTS与打断，保持真实capabilities，不调用GLM。
- C：在E:\AI4TJU\.worktrees\api读取冻结文档，按显式.env配置接通指定glm-5.1非流式、受限历史、编排与真实日志，禁止换网关或打印密钥。
- D：在E:\AI4TJU\.worktrees\knowledge读取冻结文档，构建少量真实天大资料和建筑索引，提供search/status/building函数及冻结端点，禁止造数据。

最终分别提交docs/handoffs/A.md等，报告提交号、验证/未验证、DONE/PARTIAL。M0完成后M等待这四个窗口；不提前执行M1或完成其业务。
