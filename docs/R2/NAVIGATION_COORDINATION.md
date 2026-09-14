# TJU_比赛：JS地图导航与低配额测试协调补丁

本补丁保留M0完成状态，继续原分支。JS API作为在线路线首选；不把Web端JS Key写进CAMPUS_AMAP_WEB_SERVICE_KEY。主.env尚未写入此前聊天中未确认类型的值。本轮实际高德SDK/定位/搜索/路线调用均为0。

## 已交付代码与仍待装配

- M：frontend/src/transport/amap-navigation.ts，直接复用已锁定loader1.0.1，JSAPI2.0 + Geolocation/Walking，接收真实SDK回调并规范化RouteResponse。
- M：frontend/src/transport/map-budget.ts，分类型操作计数/预算/去重/限频/取消；snapshot明确origin=frontend、kind=application_operations、platform_quota_debit=null。
- A：使用上述共享模块装配页面地图、自有POI、当前位置、路线/距离/步骤。普通问答与本地POI筛选不得调用高德搜索。外部导航入口始终保留。
- C：实现官方serviceHost安全代理、固定允许的路径/参数，并按服务类别统计代理实际HTTP请求。代理计数与前端业务发起数分源展示，不能相加当成配额扣减。现有代理仍501，新模块遇到NOT_IMPLEMENTED会在SDK之前拒绝，避免无意义消耗。
- B：speakRoute把真实步骤交给已有SpeechController.playFull，B统一净化/分句/FIFO/停止；不另开LLM/TTS链路。当前controller仍为M0 stub，真实语音联调待B。
- D：自有点位、已核验GCJ02坐标/入口/道路依据；无可靠坐标不发起规划。地图返回路线统一campus_access=unverified，之后依据D真实核验更新。
实际UI、代理、可听路线讲解和外部导航现场仍未验收，模块/隔离测试通过不代表这些已完成。

## 凭据与协议

MapPublicConfig新增route_backend="js_api"。A优先AmapNavigation.walk(RouteRequest,POI,signal)，沿用RouteResponse给界面；JS API配对Key与securityJsCode经安全代理使用。
POST /api/maps/routes及cancel保留为可选REST路线接口，只有未来明确使用REST且配置独立Web服务Key才启用；不得把JS Key误用于此处，也不得在JS失败后自动改发REST消耗第二次配额。
安全密钥仅配置在服务端；网页仅接收JS公开标识与同源serviceHost。当前未验证这组凭据有效性、来源限制或实际控制台配额。

## 分开计数

|类别|统计内容|不等同于|
|---|---|---|
|map_load|应用发起地图初始化次数|所有瓦片/脚本请求总数|
|geolocation|用户授权后的定位操作发起次数|精度保证或平台实际计费数|
|poi_search|显式在线POI查询次数|本地校园目录检索次数|
|walking_route|点击“去这里”后的规划发起次数|体验人数或控制台扣减数|

每类单列initiated/completed/failed/cancelled/blocked。调用失败、取消或超时仍保留发起计数，不返还预算；控制台配额可能已经消耗。相同操作ID不重复调用，运行中最多一个SDK业务操作，5秒冷却、每类最多6次/分钟；这些是本应用自限，不是账号实际QPS声明。
计数默认保存在当前浏览器同源localStorage，仅数字与类别，不保存位置、查询词、目标、Key、路线或原始响应。浏览器存储失败/数据损坏时拒绝新增调用；刷新不重置测试预算。账号多个Key/页面/机器可能共享配额，本地计数不能作为全账号的硬保证。
C的代理限频需覆盖SDK实际子请求；不通过轮询/探测重试反复耗费额度。用户位置更新只移动标记，不自动重规划，不自动逆地理编码。Geolocation只单次调用，未开启持续watch，停止通过AbortSignal忽略迟到回调；上游是否停止仍unconfirmed。

## 低配额验证

默认MAP_SMOKE_LIMITS：地图初始化1、定位1、在线POI搜索0、步行规划1。只在主窗口做一次手动小样本，其他开发窗口跑隔离fixture。没有控制台预算核验前不放大上限，不自动重试、压力测试或批量定位。
真实测试前必须完成：安全代理可用、Key类型/来源限制核对、D可靠目标坐标、用户同意定位。当前这些缺口使真实联调保持未验证，不消耗Key“试错”。

隔离测试命令：
```powershell
npm.cmd run build
node scripts/check-adapters.mjs
node --test tests/maps/navigation.test.mjs
```
覆盖：分类计数；无授权/预取消不调用；默认POI零预算；二次路线阻止；重复点击/并发；冷却；失败不退预算/不重试；刷新持久计数；坐标校区/时间验证；取消后迟到回调；IP粗定位拒绝当精确起点；真实步骤结构交现有语音模块。
fixtures的坐标仅隔离测试，不进data/knowledge、正常页面、模型状态或运行日志。未使用用户位置或真实Key。

30人×2次=60次路线业务发起，仅作需求估算。若控制台实际剩余额度R、保留测试预算B、实测每人消耗k，可估算floor((R-B)/k)，还须分别受地图初始化、定位、搜索及QPS约束；日/月统计口径以控制台为准。
检查高德控制台“流量分析→配额管理”的各服务额度/已用量/QPS；不要用旧公开通用配额表冒充TJU_比赛账号额度。需要分享时仅提供遮住所有凭据的统计截图。

官方核验：[JS路线插件](https://lbs.amap.com/api/javascript-api-v2/tutorails/car-dir)、[坐标步行结果](https://developer.amap.com/api/jsapi-v2/example/walking-route/walk-custom)、[服务端安全代理](https://lbs.amap.com/api/javascript-api-v2/guide/abc/jscode)、[JS配额及控制台QPS](https://lbs.amap.com/api/javascript-api-v2/flowlevel)、[当前基础服务计费说明](https://lbs.amap.com/pages/base_service_price)。

## 协调同步

M把补丁提交到原integration/m0，不移动r2-baseline。窗口先确认工作已提交/干净再按M提供COORD_COMMIT同步一次；有新功能提交时不能盲目运行Prepare-R2或reset。本次若四树仍干净且可快进，M统一快进；实际启动HEAD以同步结果为准。
