# 本地体验说明（R2 M0 基线）

现在仍是原珂莱塔校园导游；M0只准备增量修复契约。双校区本地图、授权定位/按需路线、语音队列、页面流式和独立生成结果尚未实现。已知生成故障详见BASELINE，不能把当前版本当R2验收通过。

主目录启动：
```powershell
cd E:\AI4TJU
.\scripts\stop.ps1
.\scripts\start-app.ps1 -Build
```
打开 http://127.0.0.1:8000 。首次新机器需先 .\scripts\setup.ps1；本机现有环境和模型配置复用，无需再次输入模型Key。关闭只用 .\scripts\stop.ps1（核对本项目PID），不关全系统node/python。

开发模式：
```powershell
.\scripts\stop.ps1
.\scripts\start-dev.ps1 -WebPort 5173 -ApiPort 8000
```
打开 http://127.0.0.1:5173 。工作窗口按PARALLEL_RUN自己的目录/端口启动，避免挤占主应用。

建议当前试用：普通聊天一句中文问候；切北洋园点击现有图书馆卡片，再问有出处的问题；观察请求开始/结束日志；生成欢迎词若报模型不匹配，这是已记录待C修复的问题。
浏览器工具在M0被URL识别策略停止，以下待用户现场或M1工具恢复后逐项检查，未验证项不得填写PASS：
1. 看到珂莱塔Live2D加载，控制台无素材404；缩放窗口检查布局及中文输入法Enter不误发送。
2. 生成80字迎新欢迎词，记录页面错误和对应request_id；不截密钥配置页。
3. 明确开启自动播报后问一句短问题，听是否有声、是否读URL；播放中“停止”是否清除声音。
4. 请求等待期间切校区/清空，检查旧回复或音频有无进入新界面；已知旧版本存在风险。
R2完成后按ACCEPTANCE_MATRIX实测三种生成、5次连续播报、本地图、外部导航与可选在线能力，并记录真实首正文/首可听/完成时间。

地图配置可选，全部只写未跟踪主.env：
```powershell
.\scripts\Configure-Map.ps1 -Kind Js
.\scripts\Configure-Map.ps1 -Kind Security
# 需要应用内路线规划再配置独立 Web 服务 Key
.\scripts\Configure-Map.ps1 -Kind WebService
```
每条是本机隐藏输入。JS Key与安全密钥属于同一Web端应用的对应配置；Web服务Key为另一服务类型，不能互填。只做已有类型对应配置，不新建Key或修改控制台权限。
JS Key作为受来源限制公开标识；安全密钥/Web服务Key只在后端。A按官方serviceHost在加载JS前指向同源代理。当前代理和路线是stub，配置存在仍不是可用证明。
定位实现后只在用户点击开启并授权时启动，可停止；外部导航始终保留。缺Key、拒绝定位、无可靠目的坐标、限频时不阻塞基础导览，不能把示意图位置当精准导航。

补充：在线路线优先走JS API，可选Web服务Key只给后端REST方案，不是JS路线必需。真实地图测试默认初始化1/定位1/在线POI0/路线1；先读NAVIGATION_COORDINATION.md并核对控制台配额，其他测试用fixture。
