# R2 原分支与原工作树并行运行

用户要求优化原有成果。集成继续 E:\AI4TJU / integration/m0；原四目录分支安全快进到本轮真实基线，不创建替代产品或重新初始化。
BASE_COMMIT_R2 为不可移动标签 **r2-baseline** 的40位提交，包含本轮契约、配置、骨架、测试和文档，不是旧m0-bootstrap。用 `git rev-parse r2-baseline` 查看；实际运行记录在主目录 .runtime/R2/parallel-state.json，每树 .runtime/BASE_COMMIT_R2。提交不能包含自身最终哈希，故不循环补提交。第一轮BASE_COMMIT文件及tag保留。

|窗口|绝对路径|原分支|前端/后端端口|
|---|---|---|---|
|M|E:\AI4TJU|integration/m0|5173 / 8000|
|A|E:\AI4TJU\.worktrees\ui|work/ui|5174 / 8001|
|B|E:\AI4TJU\.worktrees\avatar|work/avatar|5175 / 8002|
|C|E:\AI4TJU\.worktrees\api|work/api|5176 / 8003|
|D|E:\AI4TJU\.worktrees\knowledge|work/knowledge|5177 / 8004|

M0审计时仅8000有项目进程；其他上述端口空闲。启动时仍检查占用，不杀其他程序。原四头为A4ca7bcf/B6150e5b/C12d877f/D9009033，均已合并；M使用scripts/Prepare-R2.ps1逐树验证git边界/分支/干净/可快进，若有新修改立即停下，不stash/reset/覆盖。
曾建integration/r2但无新提交，保留闲置，禁止作为本轮成果替代分支。

## 已准备的环境与启动

M0在每树执行相同锁文件安装、检查新包和backend导入。node_modules/.venv/.tools/.runtime是各自普通目录，无可写链接；只复用下载缓存。
Node24.19.0、npm12.0.2、Python3.11.9，uv0.12.13。原Python依赖和锁不变。新增npm锁定 @amap/amap-jsapi-loader1.0.1、eventsource-parser4.1.0；前者在线可选，后者由M传输层导出，业务流消费归A。
重装（在自己的目录）：
```powershell
.\scripts\Install.ps1
.\scripts\Copy-LocalAssets.ps1 -Source E:\AI4TJU\.runtime\asset-source
npm.cmd run build
.\.venv\Scripts\python.exe -m pytest -q
```
模型key不会复制到任何树。A/B/D直接启动自己的后端，模型可明确未配置，独立UI/语音/数据工作继续；集成真实模型验收由M/C做。
A例：
```powershell
.\scripts\Start-Backend.ps1 -Port 8001
# 第二个终端
.\scripts\Start-Frontend.ps1 -Port 5174 -ApiPort 8001
```
C的后端：
```powershell
.\scripts\Start-Backend.ps1 -Port 8003 -EnvFile E:\AI4TJU\.env
```
B语音不需要LLMkey；缺ASR须PARTIAL，不把chat作为语音服务。高德配置类型要区分；用户发来的未辨明类型配置不能擅自放入公开JS Key字段。可在主目录 scripts/Configure-Map.ps1 隐藏配置，不要求把秘密再次发到聊天。地图接口NOT_CONFIGURED不能阻塞无Key部分。

主应用体验与测试步骤见 docs/R2/LOCAL_TEST_GUIDE.md；现在是M0基线，新增地图/流式等stub未实现，不能以按钮或HTTP在线当业务通过。

## 协调与交接

先读AGENTS、原OPEN_SOURCE_DECISION/CONTRACTS/OWNERSHIP/PARALLEL_RUN及第一轮handoff，再读R2/BASELINE/CONTRACTS/OWNERSHIP/ACCEPTANCE_MATRIX与本轮任务包。
窗口只编辑OWNERSHIP范围。缺共享字段/入口/依赖立即提交 docs/requests/<窗口>/R2-主题.md：真实报错、拟改字段/包版本、公共路径、可继续的独立部分。
M审查后给独立COORD_COMMIT；窗口先提交自己的改动，暂停该接口一次，`git cherry-pick <COORD_COMMIT>`，记录已同步号；不重复cherry-pick。不允许窗口自己改锁。冲突通知M，不整块ours/theirs。
四窗口最终交接 docs/R2/handoffs/{A,B,C,D}.md：窗口、DONE/PARTIAL/BLOCKED、实际树/分支、BASE_COMMIT_R2、最终提交(消息给出即可)、改动范围、实际复用、测试及未验证、真实API状态、B语音/人物能力、D资料/地图/图片统计和版本、所需协调、已停止修改是/否。
各自提交并推送原work分支，不能提交根.env/日志/录音/依赖。M1先独立评审和返修单/复验，再经用户明确授权按D→C→B→A合并，遵守仓库owner审核门禁。M0到R2_READY即交接，不能假称本轮所有业务已完成。

## 一句话启动

- A：在E:\AI4TJU\.worktrees\ui、work/ui读取R2冻结文档，按原技术栈增量实现无Key双校区本地图/点位、独立生成结果与真流消费、校区隔离和有Key在线地图/授权定位/按需路线UI，外部导航入口始终保留；只改A范围。
- B：在E:\AI4TJU\.worktrees\avatar、work/avatar实现冻结SpeechController，复用现有适配，修复音色、跨chunk净化、串行自动短播/全文/选段、实际speaking及打断；只改B范围，不另调LLM。
- C：在E:\AI4TJU\.worktrees\api、work/api优先查明生成model_mismatch和模式门控，复用原GLM/历史/runtime接真流及终态，做地图真实配置/安全代理/外链/按需路线限频取消；只改C范围，密钥仅显式后端.env。
- D：在E:\AI4TJU\.worktrees\knowledge、work/knowledge沿用JSON存储扩充可追溯双校区原子事实/POI/检索评测/分页，自绘有依据本地图及独立图面标注，核验地理坐标/通行条件和真实照片使用依据；只改D范围，不造数补齐目标。

## M0安装协调修正
原PowerShell把uv正常stderr在全流重定向时提升为NativeCommandError，导致首树安装中断；改用隐藏独立安装进程分别重定向stdout/stderr并检查receipt，未改业务依赖。不可移动r2-baseline保持为契约基线；本协调提交作为launch_commit，Prepare-R2验证并把四个原树快进到同一launch_commit。实际两号均在.runtime/R2/parallel-state.json，窗口以launch_commit开始工作，BASE_COMMIT_R2仍记录原契约基线。不重置已快进的树。
