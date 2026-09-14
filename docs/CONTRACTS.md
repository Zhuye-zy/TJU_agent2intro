# 冻结契约 1.0.0

生效于M0 bootstrap共同基线。TypeScript：shared/contracts.ts；Python：backend/contracts.py；HTTP机器契约：shared/openapi.json。仅M修改，其他窗口走协调提交。当前选择组件组合，没有继承应用传输协议；统一HTTP JSON，不同时维护另一套WebSocket聊天协议。

## M1 实现补充（线协议仍为 1.0.0）

A/B/C/D 已停止修改并由 M 合并；未新增第二套传输协议，字段与端点保持冻结定义。下文明确写 M0 的 stub 描述属于历史阶段，当前实现以本节及 FINAL_REPORT 为准。

- health：model.configured 为指定模型配置存在；verified 为本后端进程取得模型名严格匹配的非空真实回复。它不表示持续探测在线，重启归零。测试注入的独立 provider 不改变正常进程状态。
- capabilities.chat 表示已配置聊天能力；asr 表示独立 ASR 必要配置存在；tts 仅在本进程实际合成有效音频后置 true；knowledge 来自真实数据状态；scene_3d 保持 false。配置可用、音频合成与浏览器播放分别验收。
- AvatarAdapter 已实现 Live2D renderer；动作/表情为空、lip_sync=none、is_3d=false、face_morph=false；customization=['scale'] 仅展示缩放。M1 素材 HTTP/哈希已验证，现场画面待补。
- 固定 LangGraph 工作流与后端受限历史已实现。无检索命中时返回明确不足、model=local-workflow、usage=null，不记作模型成功；真实调用必须返回 glm-5.1，否则 model_mismatch。
- 取消登记在适配器吞掉 CancelledError 时仍禁止提交迟到回复/历史；本地停止与上游确认分开。场景回执在前端完成卡片 DOM 更新检查后发送，API 测试不伪造成功执行回执。
- 前端播放从实际 onplaying 回调驱动 speaking；停止清理音频、请求代次与旧回调。日志在结束前轮询，浏览器回传事件也加入展示；导出移除原始 request/event/action 标识，保留数据白名单。
- 当前知识版本 sha256:e7d1329b9b4c，7 条摘要、2 个北洋园建筑。模型和语音实际验证见 docs/evidence/live-api.json。
- ASR 缺少独立服务；HTTP 503/asr_not_configured。Edge TTS 返回真实一次性同源音频 URL，timestamps=none；浏览器权限、可听播放和中文转录不因接口存在而判为通过。

## 通用

仅127.0.0.1/localhost。浏览器只请求同源/api，Vite代理到本机后端；任何公网模型/ASR密钥只在后端。所有标识request_id/session_id/action_id/event_id/utterance_id使用UUID字符串，建筑ID为[a-z0-9][a-z0-9_-]{0,63}。校区枚举weijinlu（卫津路）、beiyangyuan（北洋园），这只是索引命名，不是已有知识数据。

JSON额外字段拒绝；普通请求体≤65536字节，/api/speech/asr≤2097152字节。校验错误不回显输入。错误统一为：
`{"error":{"code":"not_implemented","message":"说明","request_id":null,"retryable":false}}`。
400/422格式错误，404未知对象/端点，409重复或冲突，413超长，429容量限制，499本地请求取消，501未实现，503未配置/服务不可用，500脱敏内部错误。没有关联有效请求时request_id=null。不将上游认证头/响应原文透传。

GET /api/health → {status:"ok",contract_version:"1.0.0",model:{configured:boolean,verified:boolean},capabilities:{chat,asr,tts,knowledge,scene_3d}}。配置、HTTP在线、模型成功分别报告；M0只有HTTP在线，其他能力false。health不能为了“好看”改为true。

## Chat / Agent（C）

POST /api/chat 请求：request_id、session_id、message（1—8000字符且非全空白）、mode（campus_qa/content_generation/general_chat）、campus_id、selected_building_id（可null）。
不接受system或history字段。C是用于模型的历史唯一所有者，规则见OWNERSHIP：20条消息/32000字符，1000会话/闲置1小时，同会话单并发；失败/取消不提交轮次。A展示缓存不再发回作为历史。

非流式成功响应ChatResponse：request_id/session_id/answer/sources/model/usage/elapsed_ms/actions。usage只能来自供应商，缺少则null；sources来自实际检索，general_chat可以[]；actions只包含校验并发布的动作。M0返回501，不返回假answer或token数。
URL固定为用户指定网关，使用AsyncOpenAI；base_url从完整URL仅去掉一次/chat/completions，得到http://111.32.22.35:32592/mgate/v1。model=glm-5.1。先非流式纯文本，不启用未经实测tools、视觉、音频或embedding。失败不改网关或模型。

同request_id在保留窗口内第二次提交一律409，即使body相同，不再调用上游；用户重试须新ID。同session并发409。请求索引最多1024、运行最多128；仅淘汰终态，终态保留最长1小时或受容量淘汰。进程重启/淘汰后不保证跨期去重，返回404的旧请求不能继续ack；UUID客户端永不主动复用。这是单进程M0内存边界，C升级持久化不能偷偷改变契约。

## AvatarAdapter（B）

独立manifest、renderer、capabilities与可替换资源路径，不调用LLM。方法mount(host)→AdapterResult、setState、dispose；状态idle/listening/thinking/speaking/error，由A传入，B只控制局部表现。capabilities必须来自实际运行测试；当前renderer=false、lip_sync=none、is_3d=false、face_morph=false，动作/表情/设置为空。

首版kelaita，源角色珂莱塔；model_url=/assets/kelaita/runtime/kelaita.model3.json，core_url=/vendor/live2dcubismcore.min.js。资源有嘴形/眨眼参数但未验证驱动；无motion，水印expression不可当情绪，保留原水印。B完成后可声明amplitude嘴形，不得把RMS幅度写成viseme/准确中文口型。缩放/背景只是展示设置。

## SpeechAdapter（B）

前端start(context,callbacks)/stop(request_id)、speak(context,utterance_id,text,voice_id,callbacks)、listVoices。context含request_id/session_id/AbortSignal；取消或dispose必须释放本地采集与播放队列，失败回调只给安全错误码。ASR回调onText(text,is_final)，TTS/播放onStart/onEnd/onFailure；TTS以utterance_id标记，ASR失败以request_id标记。onStart只在实际播放开始时触发；请求返回音频不等于播放完成。stale/cancelled ID不许继续播后到音频。一次最多一个采集与一个播放，由B负责。

|端点|请求|响应|
|---|---|---|
|GET /api/speech/voices|无|{voices:Voice[],status:"not_implemented"或"ready"}|
|POST /api/speech/asr|SpeechContext + audio:AudioPayload|{request_id,text,is_final}；M0为501|
|POST /api/speech/tts|SpeechContext + utterance_id/text(≤4000)/voice_id|{request_id,utterance_id,audio_url,mime_type,timestamps}；M0为501|
|POST /api/speech/stop|SpeechContext|{request_id,local_stopped,upstream_stop}|

AudioPayload冻结为encoding=base64、mime_type=audio/wav、sample_rate_hz=16000、channels=1、audio_base64≤1500000字符；B验证实际PCM16 WAV头、采样率/声道与≤30秒时长。VAD只负责活动检测，不能当ASR；B通过独立配置的OpenAI兼容ASR服务转录，缺服务明确未配置。TTS预选edge-tts，其真实音色查询由B实现；不自动加载本地人物克隆音色。
TTS音频仅返回本机同源/api/speech/audio/<不透明ID>，该路由由B实现；禁止远端任意URL或文件系统路径。文件保留≤10分钟、≤128份/100MB，超过限额清理终态文件，播放结束及时释放。音频端点输出音频字节，错误仍是ApiError。M0未生成音频，此路由尚不可用。word时间戳不等于viseme，当前timestamps=none。

B后端必须按(request_id,session_id)持有独立speech操作登记，≤64运行操作；已知操作session不符409；stop幂等，无运行操作可返回local_stopped=true/upstream_stop=not_started。C的chat取消和B的speech停止各停止自己登记的任务；A执行取消时同时调用二者，不能只Abort fetch。无服务端资源的M0 stop如实为not_started。

## Knowledge（D）

|模块函数|HTTP映射|响应/空结果|
|---|---|---|
|search(query,campus_id,limit)|GET /api/knowledge/search?query=...&campus_id=...&limit=5|{hits:Source[],status:KnowledgeStatus}；无命中hits=[]，不可用也必须带unavailable状态|
|get_status()|GET /api/knowledge/status|{status,version,document_count,building_count,updated_at}|
|list_buildings(campus_id)|GET /api/knowledge/buildings?campus_id=...|{buildings:Building[]}，空数组|
|get_building(id)|GET /api/knowledge/buildings/{id}|内部Building或None；HTTP未知为404 ApiError，不返回伪对象|

query长1—500，limit 1—20（默认5）。Source固定id/title/snippet/url/campus_id/published_at（可null）/retrieved_at。Building固定id/title/campus_id/summary/url/published_at（可null）/retrieved_at/coordinates（{lat,lng}或null）。日期ISO8601；发布日期不详为null，实际获取日期必填。URL必须是实际资料来源，不能拿搜索页代替正文。status版本来源真实数据版本/哈希，空仓版本null、计数0、时间null。A/C只能使用D返回的ID；C在chat选择与动作发布时再次核验校区归属。

## SceneAction 与执行回执（A执行、C验证）

只接受focus_building/show_building_card。格式{action_id,request_id,type,parameters:{building_id}}；最多16动作/请求。C调用runtime.publish校验真实建筑与校区，并登记后才返回。发出只记scene started，不记completed。A实际完成2D定位/卡片展示后POST /api/scene/ack：
{request_id,session_id,action_id,status:"completed"或"failed",error_code?}。
成功不能带error_code，失败必带execution_failed或unsupported。回执校验会话、已发布动作、request/action关联、取消状态。未知404，冲突409；同内容重复回执200 status=duplicate且不重发日志。首次200 status=recorded。客户端不能通过此端点报告模型/检索成功。日志origin=backend表示后端核验并记录回执，不代表服务端目视验证UI；完成依据明确为客户端执行回执。

SceneAdapter预留kind:"2d"|"3d"和execute接口。M0没有3D场景，不展示假可用3D按钮；后续3D adapter须另行实现。

## RuntimeEvent 与轮询（C）

GET /api/runtime/events?request_id=<UUID>&cursor=0 → {events:RuntimeEvent[],next_cursor,truncated}。
event_id/request_id/seq/timestamp/origin/stage/status/duration_ms/data。seq为单进程全局递增，cursor非负；timestamp由后端赋UTC；duration_ms实测或null。事件环最多2000、请求索引如上、前端事件去重索引1024。下一次使用next_cursor，建议运行期500ms、终态停止，A每请求最多显示500条，按(origin,event_id)去重。truncated表示游标落后已淘汰段；页面明确“早期日志已淘汰”，不补造。未知/已淘汰请求404，超前cursor422。

后端事件从真实代码执行发出。前端仅可POST /api/runtime/client-events，字段见ClientEventInput：只允许stage=avatar/speech，status=started/completed/failed/cancelled，不能传origin/seq/timestamp。后端校验request/session并赋origin=frontend，重复event_id同内容返回原事件，冲突409。场景完成只能走专用ack。前端事件不是模型成功证据。

data白名单：code/action_id/building_id/count/model，可省略或null；前端仅code枚举not_implemented/playback_failed/permission_denied/stopped。不存输入文本、完整提示词、隐藏思维链、认证头、key、录音、base64、原始上游异常或供应商响应。未知额外字段拒绝。M0日志仅request started/failed及实际收到的合法客户端事件，不虚构model阶段。

## Cancel（A协调，C/B分别执行）

A先停止本地等待与播放（AbortController/B.stop），再用独立、未abort的fetch发送：
POST /api/requests/{request_id}/cancel，body={session_id}；
同时调用/api/speech/stop。响应{request_id,status:"cancel_requested"或"already_terminal",local_task_stopped:boolean,upstream_stop:"not_started"|"unconfirmed"|"confirmed"}。

local_task_stopped只表示服务端chat任务已经终止，不替客户端确认浏览器状态。cancel_requested时可为false，随后轮询request cancelled事件。HTTP中断或本地task.cancel不等于上游确认停止；一旦发出供应商调用，除非有确切确认机制，upstream_stop=unconfirmed。M0未调用上游，值not_started。未知请求404、session不匹配409；终态重复取消200 already_terminal。已返回的成功轮次不因后来点击取消而回滚，已取消请求拒绝新scene回执。

## M0与后续边界

M0的工作流实际使用LangGraph编译stub，只产出not_implemented状态；模型/ASR/TTS只建立接口与成熟依赖构造入口，未联网验证。上述history、音频文件生命周期、生产转录与队列是已冻结约束，实际实现分别归C/B。共享边界测试不构成全部业务完成证明。
