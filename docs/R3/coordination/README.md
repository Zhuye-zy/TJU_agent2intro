# R3 并行协调台账（M）
更新：2026-09-15。M分支prepare/r3-m0；共同启动基线r3-launch=0bf2e4bc8f49a9697878eaf0db614a1017ace5c1保持不动。

用户最新规则：共享字段、依赖、导航公共模块、入口装配由M集中发布独立协调提交，**仅受影响窗口同步**。业务窗的未提交修改与停止修改状态由原窗口维护；M不重跑Prepare-R3覆盖并行现场，不整体merge业务分支。

## 已发布协调

|编号|精确COORD_COMMIT|受影响窗口|处理内容|
|---|---|---|---|
|001|af0384a43492e2c215151b90428fc3d4b45c7abf|A、C|message/必去/避开/日期/步行上限、结构澄清、skip/end、风险确认和评测指标|
|002|8a888f6bca11c77578f0847aa700196984281d33|A、B|同一个SpeechController注入、bind/interrupt/能力接口、公共装配检查、Avatar音量入口|
|003|3e957fb13e1f2497f405c674dbef2855f1ffdfb7|A、C、D|D同库时效资料公共接口/HTTP装配、媒体可空poi_id、资料/schema/类型|

每个提交都已通过独立临时Git索引检查，可单独应用到r3-launch，无隐藏的其他协调依赖。临时索引没有改业务工作树。对应说明为001-tour.md、002-speech.md、003-knowledge.md。

## 各窗同步单

先提交或妥善保存自己的业务改动，确认没有未完成的Git操作，再执行对应命令。不要以reset/clean/stash替代现场保护，有冲突提交具体文件与错误给M。

- A：git cherry-pick af0384a43492e2c215151b90428fc3d4b45c7abf 8a888f6bca11c77578f0847aa700196984281d33 3e957fb13e1f2497f405c674dbef2855f1ffdfb7
- B：git cherry-pick 8a888f6bca11c77578f0847aa700196984281d33
- C：git cherry-pick af0384a43492e2c215151b90428fc3d4b45c7abf 3e957fb13e1f2497f405c674dbef2855f1ffdfb7
- D：git cherry-pick 3e957fb13e1f2497f405c674dbef2855f1ffdfb7

M已把各自相关的M-COORD-00N.json放到受影响工作树.runtime/R3/，包含精确提交、说明路径和命令；未替窗口执行cherry-pick。工作窗同步后在自己的handoff记录精确COORD_COMMIT和业务接入/测试结果。已经停止修改的窗口若继续处理本协调，应更新交接状态，完成后再次停止。

本台账只在M分支维护，窗口可直接读取主目录，无需为台账另行同步一个无关提交。

## 请求处理状态

|请求|裁定/状态|
|---|---|
|A R3-interface-gaps 1—3|001已发布，A/C接入待验|
|A 第4项、B单队列/口型入口|002已发布；A无参工厂须改为复用原队列，B业务模块由A在交付后装配|
|A 第5项|003已发布，D填写来源确认的关联、A按poi_id选择|
|C输入/动作/评测|001已发布；C需正式读取新增字段、净化message、写completion_reason、真实指标观测来源|
|C请求D公共证据与成本|003已发布；D实现同一LocalKnowledge方法，C消费适用日期/冲突元数据；真实未知成本仍null|
|B独立ASR配置|外部BLOCKED：M显式读根配置后URL/model/key均为空；已向用户询问是否另有本机配置文件路径，不收聊天中的密钥|
|新增依赖|当前没有必须加包的请求，本批依赖及锁文件未变|
|导航公共模块|当前保留原同源JS/IP/匹配/内部步行与预算链；本批无独立导航修改请求，不代做窗口业务|

## 验证

- M整合三项公共协调后：92项Python回归通过；70项原前端回归+2项R3传输+2项语音装配通过；生产及适配器构建通过。
- R3通用和独立知识schema/type一致性通过。
- 三提交分别对r3-launch的独立补丁应用检查通过。
- 不把以上结果当业务窗口的新字段接入已完成，也不当真实ASR/地图现场通过。
- 日志：主目录.runtime/R3/coordination-check.log与coordination-independence.json。没有复制秘密或修改业务树代码。

M1尚未开始；当前只处理并行共享需求与发布协调。