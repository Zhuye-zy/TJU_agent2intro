# 珂莱塔本地试用与验收
当前候选 **R2_PARTIAL**，不是所有比赛功能完成。先打开 **http://127.0.0.1:8000**。这台电脑已有模型key、依赖和本地kelaita素材，模型key无需重新输入。不要在聊天、前端或Git中放密钥。

## 启动、停止与检查
PowerShell：
```powershell
cd E:\AI4TJU
.\scripts\stop.ps1
.\scripts\start-app.ps1 -Build
.\scripts\check-api.ps1
```
只停止脚本登记且PID/创建时间匹配的本项目进程；端口占用时不会杀其他程序。生产网页和API同源8000；当前只监听127.0.0.1。
开发模式（先停生产）：
```powershell
.\scripts\stop.ps1
.\scripts\start-dev.ps1
```
开发URL http://127.0.0.1:5173，后端8000。主目录代理实测使用临时5183指向8000，已停临时进程。
依赖需重装时运行 `.\scripts\Install.ps1`。从Git新取源码不含角色/Core，可在已授权本机归档存在时运行 `.\scripts\Copy-LocalAssets.ps1`；不得自行取得无授权人物资源。
隔离回归（不主动请求GLM或高德）：
```powershell
.\scripts\check-r2.ps1
```
真实模型8次小规模评测，仅需要时手动运行（不调用地图）：
```powershell
.\.venv\Scripts\python.exe scripts/verify-r2-live.py --output .runtime/R2/manual-live.json
```
该脚本的ok只验证传输/非空；生成是否满足要求仍要读实际页面结果。不要反复运行耗费资源。

## 建议按这个顺序体验
1. 卫津路：查看点位目录，翻页/类别/关键词筛选，点击第九教学楼；本地示意图可缩放、点选，但不是精确地图。点击“介绍这里”后发送，查看对应校区来源与日志started→终态。
2. 切北洋园，选郑东图书馆重复；试“建造年代是什么”。无资料时应明确未知；无证据不能新增点位或编开放时间。切校区后旧回答可留原历史，当前地图/声音不应受旧任务影响。
3. “内容生成”分别试校园社交文案（约150字迎新欢迎词）、导游讲解词（选择郑东馆）、参观计划（已知点位组合）。正文应逐步出现，最后结束；试复制、导出、朗读和“展开讲讲”。同一个request_id应能在运行日志追踪。
4. 点“开启语音导览”，选择自动简述与中文音色。若浏览器拦截，亲自点“恢复声音”。连续5个简短回答检查真的听见；再试全文/单段/继续讲、停止播报。正文中的来源仍可查，语音不应读URL/Markdown。
5. 长回答途中点停止回答，再新提问、重试、清空、快速切两次校区；旧文字/旧音频不能回来。上翻历史时新流入内容不应强制跳底。中文IME选字时Enter不应发送。
6. 缩小浏览器至手机宽度，检查地图与导览/对话与生成切换、错误和空状态。真实手机跨设备访问目前未开放LAN监听；不能直接用手机127.0.0.1访问电脑。后续配置LAN和安全上下文后再验麦/定位。

当前ASR未配置：“语音输入”不能视为已完成中文识别。TTS服务合成已通过，实际自动播放/扬声器/人物speaking需你现场验证。没有精确口型时间戳。

## 地图与配额：本地先用，在线按需
- 无Key目录、示意图、知识和外部高德入口可用。当前所有真实经纬度为空，外链是带校区的**名称搜索**，请在高德确认目标，不能称已精确导航到楼门。
- 当前JS/Security/WebService均未配置。请仅依据高德控制台各字段的明确类型，在本机隐藏输入：
```powershell
.\scripts\Configure-Map.ps1 -Kind Js
.\scripts\Configure-Map.ps1 -Kind Security
```
这些配置脚本已检查，真实Key有效性未验证。JS Key是网页标识；安全密钥只在服务端安全代理中。WebService仅可选REST需要，不能拿JS Key替代。配置后停止并重启应用。
- 有有效Key仍须先补经地图核验的目标坐标。授权定位后显示来源/精度/时间；粗定位不冒充GPS，校外位置不能强制移到校园。拒绝权限后手动GCJ02起点只表示用户输入，不是GPS。
- 每浏览器默认测试预算为地图载入1、定位1、POI搜索0、步行规划1；失败/取消不退预算，刷新不重置。定位更新不自动规划，点“去这里”才规划；超限保留外链。不要清浏览器预算反复试。
- 本次实测高德调用0。线上控制台配额/QPS未核对；SDK内部请求与业务次数分别统计，不能许诺某Key支持固定人数。
- 路线距离/步骤必须来自真实高德返回；校园门禁、入口、施工未知仍标未核验。校内设备每校区10点/3路线抽查另安排，本轮不消耗配额凑“验证”。

## 数据更新与评测
查看当前语料校验及固定题集：
```powershell
.\.venv\Scripts\python.exe -m backend.knowledge.importer
.\.venv\Scripts\python.exe -m backend.knowledge.evaluate --output .runtime/R2/retrieval.json
```
上述命令本轮通过。新增资料先准备完整暂存JSON目录，附来源/日期/校区，运行（把示例路径换为实际目录）：
```powershell
.\.venv\Scripts\python.exe -m backend.knowledge.importer --staging E:\AI4TJU\.runtime\verified-data --dry-run
```
校验成功后停服务，再用同一命令去掉--dry-run导入，再启动。这个示例目录不预先存在；不把示例当已导入。单次异常回滚；需要恢复备份可停服运行 `python -m backend.knowledge.importer --restore-last-backup`（须已有备份）。
请勿抓取需登录/验证码页，照片要逐张有使用依据；原图没取得不得写入可显示manifest。

## 如何记录体验问题
记录校区、点位、操作、request_id前8位、时间和错误码；运行日志可脱敏导出。截图只拍应用，不拍控制台或密钥配置。明确记录“真实听到/没听到”、是否点击恢复、浏览器版本。截图可放docs/evidence/，确认无秘密再提交；原始录音/日志继续留忽略目录。
