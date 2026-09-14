# R2 D 交接

状态：PARTIAL。工作树 `E:\AI4TJU\.worktrees\knowledge`，分支 `work/knowledge`，基线 `r2-baseline` / `.runtime/BASE_COMMIT_R2`：`e272ed9b3eb31b57868f6e1077036a896750361f`。

## 完成内容

- 修复 R2 知识端点的 501：同一个 `LocalKnowledge` 现在支撑 legacy search/buildings 与 R2 POI、coverage、campus-assets 视图；未另建数据库。
- 加入 `pois.json`、`assets.json`、`SOURCE_REGISTRY.json` 和显式离线维护器。分页 cursor 绑定数据版本、校区、类别和查询；篡改或过滤条件不匹配返回 400。
- 检索继续为关键词、别名和中文二元 n-gram，明确不是向量检索；查询和模块导入不联网。
- 增加 92 个去重 POI：卫津路 45、北洋园 47。来源为有限读取的官方导览、图书馆、场馆和迎新页；同名跨校区保留不同 ID，北洋园东门复用 legacy ID。
- 坐标、入口、图面标注、路线通行证据和可显示实景照片均未填充。媒体 manifest 为空，未下载官网图片。

## 实际读取与来源状态

已读取：`fw.tju.edu.cn/Weijin.html`、迎新网食堂信息、校方图书馆、场馆中心、校区概览；北洋园导览的直接打开返回错误，只使用检索结果中已实际展示的名称目录。6 个来源和每个获取/许可/robots 状态见 `data/knowledge/SOURCE_REGISTRY.json`。robots 请求返回错误，未推断许可或禁止；未全站爬取、未调用地图厂商或北洋维基。

## 真实统计与缺口

版本 `sha256:903be5057aa1`，来源页 6、旧摘要 7、POI 目录事实 92、原子事实 99、全文 chunk 0、可用媒体 0、经核验坐标 0。80 POI 及每校区 30 项已达成；200 原子事实仍差 101，坐标/每校区十点抽查/三条路线/每校区两张许可照片均未完成，因此不能标 DONE。详见 `docs/R2/DATA_COVERAGE.md`、`COORDINATE_AUDIT.md`、`MEDIA_MANIFEST.md`。

## 验证

- `.venv\Scripts\python.exe -m pytest -p no:langsmith -q tests\knowledge\test_local_knowledge.py tests\knowledge\test_r2_catalog.py`：9 passed。
- `python -m backend.knowledge.importer`：受管文件计数为 sources 6、documents 7、buildings 2、POIs 92、assets 2。
- FastAPI 实测：分页无重复、coverage.fact_count=99、空媒体清单；unknown POI 为 404。

已停止后续修改，等待 M 评审。需要共享契约、入口或依赖的变更：无。
