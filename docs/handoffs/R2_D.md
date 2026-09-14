# R2 D 交接与 M1 返修

状态：PARTIAL。工作树 `E:\AI4TJU\.worktrees\knowledge`，分支 `work/knowledge`。
R2 基线 `e272ed9b3eb31b57868f6e1077036a896750361f`；M1 审查起点 `41a95f0`。
已停止修改，可以合并：是（本交接提交后以消息报告最终哈希）。

## 返修回复

|编号|最小行为变化|独立验证|
|---|---|---|
|D01|POI 是唯一实体目录；legacy Building 由同一 POI 投影，稳定 ID、校区一致。补郑东旧 ID；新事实 Source 可检索；修卫津两馆描述；“天大的斋”集合退出独立 POI 计数；未证实宿舍用途的六园转 other；补校方迎新明确的八个宿舍区域。|106 个目录实体全部有同 ID 建筑投影；三问桥和春水馆检索有真实出处；旧模型模块测试保留。|
|D02|cursor 仅存固定长度过滤摘要和 offset；严格拒绝非对象/多余字段/bool/负值/越界。目录精确名称、别名优先。|长中文 query 全页遍历，cursor ≤256；恶意 payload 全部400；筛选与数据版本绑定。|
|D03|新增严格 KnowledgeRecord facts.json；只统计其129条独立事实，旧7复合摘要保留检索但不计入原子事实。来源实际去重为8；坐标计数要求来源、核验日、质量和实体状态。|原子记录/分校区计数一致，资料版本来自实际文件；坐标0。|
|D04|2张自行绘制的抽象SVG示意，29个相对标注由实际查看的2017校方内嵌地图人工读取，保留原图归一化位置审计。冻结40证据+10未知/歧义题及评测器。|Recall@5=87.5%（35/40）；另10/10。相对标注卫津15、北洋14；只有历史图面核验，不是地理坐标或当前现场导航。|
|D05|离线安装先验证全部模型、ID、来源、实体/校区及图面引用；留存完整备份；逐文件替换失败时恢复全部已改文件；支持显式恢复备份。|非法来源在修改前拒绝；注入第二次替换失败后所有活动文件字节恢复；完整备份恢复通过。|

## 实际数据与来源

- 106个独立 POI：卫津50、北洋56；两校区八目标类别均有记录，但历史宿舍/食堂和部分目录项目当前用途仍需核验。
- 129条原子事实；旧摘要7；检索 Source 视图136；全文chunk 0；来源URL8。200事实目标差71，未补成虚构数字。
- 地理经纬度0；入口经纬度0；可用实景照片0。两张SVG是示意图，绝非照片、3D或精准地图。
- 校方当前高清附件要求验证码，已停止该下载路径。实际采用另一公开2017招生页内嵌地图，仅在本工作树忽略目录供人工核验；未提交或再分发原图。
- 新事实依据校方图书馆、2024迎新、原导览及2017地图。来源登记与访问状态见 SOURCE_REGISTRY.json；北洋导览本轮直接打开仍失败，之前只读到搜索目录的项目不夸大为当前现场核验。
- 2017相对布局不证明当前道路、门禁或建设情况；路线通行全部保持未核验。没有高德请求、配额消耗或外部地图凭据读取。

## 可执行验证

```powershell
$env:PYTHONDONTWRITEBYTECODE='1'
.\.venv\Scripts\python.exe -m pytest -p no:langsmith -p no:cacheprovider -q tests/knowledge
.\.venv\Scripts\python.exe -m pytest -p no:langsmith -p no:cacheprovider -q tests/model tests/knowledge
.\.venv\Scripts\python.exe -m backend.knowledge.importer
.\.venv\Scripts\python.exe -m backend.knowledge.evaluate --output data/knowledge/evaluation-result.json
```

结果分别22 passed、36 passed、模型与引用校验通过、40条Recall@5=0.875/另外10条通过。
曾尝试不存在的 tests/test_contracts.py，pytest未执行；已改为真实 tests/model 与 tests/knowledge，未把该次算通过。

评测是固定本地资料的检索，不代表指定模型、浏览器或现场语音已通过。5道漏检保留在 evaluation-result.json，不通过修改题目提高分数。歧义题仅验证多个实体进入检索结果，不能证明模型已澄清。

维护：`python -m backend.knowledge.importer --staging <已核验完整JSON目录> --dry-run`；
明确停止服务后取消 dry-run 才安装，成功后重启服务读取新快照。运行时不热重载，不声称多个文件对并发读者具有数据库事务隔离；发生单次替换异常会回滚。备份在数据目录 .backups（忽略），保留已有备份，不删除上次版本。

## 仍需总控验收

- 2张示意图及29标注的浏览器点选/卡片/动作回执，与A集成后确认。
- 新实体在C所选点→“介绍这里”完整链路、跨校区校验与来源渲染。
- ≥200事实、≥80%真实经纬度、每校区2张许可照片、现场每校区10点/3条路线仍未达成。数据数量缺口是尚未完成，不能归因没有地图Key。
- 没有新增依赖或共享契约变更。增加 `get_assets` 同义方法兼容C，原路由 `get_campus_assets` 保持。
