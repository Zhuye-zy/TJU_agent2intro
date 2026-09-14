# R2依赖核验

沿用第一轮组件路线与完整锁文件；不删除底座依赖、不迁移框架。核验日2026-09-14。

|包|实际安装/锁定|已读文件|复用强度与边界|
|---|---|---|---|
|eventsource-parser|4.1.0，MIT|node_modules/eventsource-parser/{package.json,README.md,LICENSE,src/parse.ts}|直接依赖；M transport/r2.ts re-export createParser，A将实现流消费。支持跨chunk行解析/maxBufferSize，不得把SDK依赖装好当正文流已验收。|
|@amap/amap-jsapi-loader|1.0.1，package.json声明MIT|node_modules/@amap/amap-jsapi-loader/{package.json,README.md,src/index.ts}|直接依赖预装；A按用户动作动态加载JSAPI2.0和Geolocation。代码顶层依赖window，不能在后端/SSR直接执行；默认1.4.15必须显式覆写2.0。发布包无单独LICENSE，保留metadata且如实记录缺口。|
|httpx / FastAPI / OpenAI SDK / LangGraph|原锁不变|第一轮审查见OPEN_SOURCE_DECISION与DEPENDENCY_LICENSES|路线后端复用httpx，StreamingResponse沿用FastAPI；C扩展原provider/workflow/runtime，不能另写第二模型系统。|
|React / SVG|原锁不变|现有前端工程|无Key本地图无需在线SDK；D自绘有依据示意图/授权图，A渲染交互。|

锁文件package-lock.json记录下载integrity；未克隆新大型底座。eventsource-parser许可证在docs/licenses；AMap loader metadata另存。高德JSAPI、地图数据/路线是在线服务，使用范围和配额由平台条款决定，不受loader的MIT元数据覆盖。

官方参考：[eventsource-parser](https://github.com/rexxars/eventsource-parser)、[高德加载器](https://lbs.amap.com/api/javascript-api-v2/guide/abc/load)、[安全代理](https://lbs.amap.com/api/javascript-api-v2/guide/abc/jscode)、[定位](https://lbs.amap.com/api/javascript-api-v2/guide/services/geolocation)、[路线](https://lbs.amap.com/api/webservice/guide/api/direction)。首次页面调用、定位授权、真实地图/路线尚未验证。

安装保留npm对protobufjs postinstall的既有阻止策略，当前build通过；未修改全局策略。其余新增依赖由各窗即时提docs/requests，由M协调锁文件，不能各窗擅自安装。
