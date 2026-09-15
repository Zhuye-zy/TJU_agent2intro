# C → M / D：R3协调请求（2026-09-15）
基线0bf2e4bc8f49a9697878eaf0db614a1017ace5c1，work/api。

- 用户要求skip/end，TourCommand目前拒绝；请求M补动作、状态语义、TS/schema，C先做内部处理，不绕过公共校验。
- TourRequest缺自然语言、must_visit/avoid、日期和步行上限、澄清结果；C从interests识别已输入约束、warnings集中澄清，请M冻结正式字段及入口。start缺unknown风险确认字段，当前check→start为两次显式确认。
- EvaluationRecord缺联网次数、重试、首正文和方案标识；C先提供内部指标导出。基线对照使用M保存r3-launch原service.py，不能重写简化方案冒充。
- D请提供同一LocalKnowledge的public行程资料接口：按POI ID取得entity/campus、核验时间、适用范围、有效期、支持关系的原子事实；以及RouteCostResult和独立证据。现search(Source)不能证明时效，C仅记retrieved/unverified和null成本。
- 独立继续：真实目录接入、隔离算法夹具、状态/双版本/幂等/取消/恢复；无需以上新字段。公共修改仅M协调。
