# R3 四窗启动与交接

## 唯一基线及端口

M分支 `prepare/r3-m0`，基线 `git rev-parse r3-launch`。发布后五个HEAD相同，四树BASE_COMMIT_R3相同，以M的 `.runtime/R3/parallel-state.json` 为精确回执。旧R2启动/Prepare脚本不能用于本轮。

|窗|目录|分支|前端|真实/未配置后端|隔离fixture后端|
|---|---|---|---|---|---|
|M|E:\AI4TJU|prepare/r3-m0|5173|8000|不用业务fixture端口|
|A|E:\AI4TJU\.worktrees\ui|work/ui|5174|8001|8011|
|B|E:\AI4TJU\.worktrees\avatar|work/avatar|5175|8002|8012|
|C|E:\AI4TJU\.worktrees\api|work/api|5176|8003|8013|
|D|E:\AI4TJU\.worktrees\knowledge|work/knowledge|5177|8004|8014|

审计时仅8000占用（原应用），不停止或重启。其他端口分配不等于已经启动，启动前检查冲突，不杀其他进程。所有服务器只绑定127.0.0.1。

## M发布门槛

1. 主目录共享契约检查、完整现有回归、构建通过；测试夹具不进入生产。
2. 创建不可移动r3-launch标签，保留原分支和全部现场。
3. `scripts/Prepare-R3.ps1` 对ALL树预检干净、同名分支、祖先关系、依赖普通目录、无.env，然后逐树安全快进、按锁安装和独立检查。
4. receipt.status=R3_READY且四树同40位号，才发送启动消息。失败即R3_NOT_READY；保留已完成工作，不回滚。
5. 共享变更以后单独COORD_COMMIT仅发布给受影响窗口；各窗先提交业务再cherry-pick一次。不要各自从远端不同分支拉“最新”。

原树不安全时不stash/reset/覆盖。M可建立 `.worktrees/r3-<窗口>` 新隔离树，从同一基线复制安装依赖（不共享可写目录）并公布替代路径/端口；独有修改由原作者审查迁移。本轮原树均可安全快进，已优先复用。

## 启动示例

先在自己的路径确认 `git status --short`、`git rev-parse HEAD`、`Get-Content .runtime/BASE_COMMIT_R3`，阅读R3五份文档和原规范。

A联调合成行程（两个终端）：
```powershell
.\scripts\Start-R3-Fixture.ps1 -Port 8011
.\scripts\Start-Frontend.ps1 -Port 5174 -ApiPort 8011
```
此服务只提供行程协议模拟和本地知识读取，无真实模型、地图或音频；A在新行程视图显示“开发测试数据”。其他模块不应将fixture当真实通过。

A正常知识/现有UI开发：
```powershell
.\scripts\Start-Backend.ps1 -Port 8001
.\scripts\Start-Frontend.ps1 -Port 5174 -ApiPort 8001
```
B用8002/5175，C用8003/5176，D用8004/5177。各窗不要改源码默认地址，使用已有端口脚本。同一前端一次只代理一个后端，需要联调时显式切换，防止把fixture和live证据混在一起。

仅M/C按需显式：
```powershell
.\scripts\Start-Backend.ps1 -Port 8003 -EnvFile E:\AI4TJU\.env
```
根秘密不复制到树。B需要ASR配置时走M协调的专用进程配置，不把LLM端点当ASR。A/B/D无需读取根.env。没有配置的真实服务返回明确错误，继续独立部分。

## 检查命令

```powershell
.\scripts\check-r3.ps1
# 快速公共接口核对
.\.venv\Scripts\python.exe -m pytest -p no:langsmith -q tests/test_r3_contracts.py
.\.venv\Scripts\python.exe scripts/export-r3-schema.py --check
npm.cmd run typecheck
```
Prepare-R3使用offline frozen uv同步、copy模式和npm ls，npm锁未变化。缓存不足由M使用正常 `scripts/Install.ps1` 处理，不自行改锁。每树日志都在自己的.runtime，不能建立node_modules/venv可写链接。

## 四窗第一轮任务

- **A**：实现60分钟行程输入与卡片、开始/到达/讲解/完成/下一站、剩余计划编辑、暂停恢复取消和显式保存刷新；接R3 transport与B事件，公共导航保留IP/匹配/内部步行/外部入口；移动端体验与旧响应保护。
- **B**：实现shared/r3-speech.ts入口，真实中文ASR与连续语音、插话/实际播放事件，原队列和四音色保持兼容；音频RMS→基础嘴形；无ASR如实阻塞而非预设文本。
- **C**：实现tour_service/cost_service槽、状态机/双版本/幂等/取消/可信恢复/约束/证据/usage；复用唯一HistoryStore与原模型、地图链，不能另建LLM历史或偷用fixture作为生产实现。
- **D**：在已有双校区库中确定3—5站可执行核心线及校园服务规则；别名歧义、开放/入口证据及期限、授权实景、冻结独立任务题集。资料不足明确unknown，禁止造坐标、通行时间或照片。

## 交付与停止修改

写 `docs/R3/handoffs/<窗口>.md`：实际路径/分支、BASE_COMMIT_R3和已同步COORD_COMMIT、最终提交、改动路径、实际复用、测试命令/结果、fixture与live分别列、依赖/未验证项、矩阵ID、DONE/PARTIAL/BLOCKED及“已停止修改：是/否”。

各自提交授权范围的文件后停止修改并通知M。M1才执行独立评审→集成→返修→真实场景验收。当前M0不自动启动四个代理代做业务、不合并后续PR、不把准备通过写成业务完成。