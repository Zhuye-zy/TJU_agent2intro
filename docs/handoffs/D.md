# D 知识库交接

状态：DONE（D 所有权路径）；等待 M 做 health capability 装配协调。

## 实现

- `LocalKnowledge` 使用与项目一起搬移的 `data/knowledge` 相对路径；导入及每次查询均不联网。
- 未配置 Embedding 服务，故检索明确采用确定性的关键词、别名和 CJK 字符 n-gram 匹配；返回最多调用方给定的 `limit` 条短事实片段和原始官方 URL。
- 资料库包含 7 条事实摘要、2 个北洋园建筑对象（郑东图书馆、北洋园校区东门）。建筑 ID 与关联资料使用 `building_id` 连接；坐标均为 `null`。
- `SOURCES.md` 单独记录来源与使用条件；不保存网页全文、图片或北洋维基素材。2017 年地图记录明确是历史资料，不能用于当前导航。

## 本轮实际读取

- https://yx.tju.edu.cn/tdfc/xyfgbyy/ （2024-08-15）
- https://yx.tju.edu.cn/jztd/cx/201806/t20180602_307318.htm （2024-08-15，未录入地图内容）
- https://mpa.tju.edu.cn/info/1145/1235.htm （2018-09-26，未录入其图片地图）
- https://zs.tju.edu.cn/info/1091/1227.htm （2017-06-01）
- https://www.tju.edu.cn/xywh.htm （入口；跟进其官方“天大校区”页面）
- https://www.tju.edu.cn/tdgk/tdxq.htm （页面未列发布日期）
- https://mse.tju.edu.cn/ （入口，未用作事实来源）

所有录入项的获取日期为 `2026-09-14`。字段缺口：没有可靠坐标、楼高或入口资料，均没有推断填入。

## 验证

运行：`.\\.venv\\Scripts\\python.exe -m pytest -q tests/knowledge`

覆盖：事实命中、校区别名与建筑关联、跨校区过滤、无法回答返回空、完整来源字段、历史地图年份、空资料目录的 unavailable 状态。完整基线测试中的 `test_limits_and_empty_knowledge` 仍是 M0 空库断言，需 M 按 `docs/requests/D/knowledge-health-capability.md` 协调更新。
