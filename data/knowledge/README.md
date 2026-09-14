# D 数据使用说明

权威运行数据：pois.json（实体）、facts.json（独立事实）、SOURCE_REGISTRY.json（来源）、assets.json（图面/媒体）。documents.json保留旧摘要检索，buildings.json为旧数据兼容输入；对外建筑以canonical POI覆盖，不能分别维护两套相互矛盾的目录。

evaluation.json 是本轮首次运行前冻结的人工相关事实题集。evaluation-result.json 为当前本地语料独立运行输出，不含模型调用、用户位置、音频或密钥。5道漏检不隐藏。后续改变题集须单独记录版本，不能拿修改后题集与原版结果直接比较。

schematic_audit.json 记录人工读2017公开地图的归一化坐标。原参考图保留在工作树 .runtime/r2-review，受Git忽略；它不是可再分发媒体，也不会被应用读取。SVG自绘，不含原图纹理、商标或复制底图。图面当前标注的年份与真实素材限制应在界面保留。

本轮独立照片为0，manifest保持空。未核验高德经纬度为null；图面坐标不得用于外部导航URL或当前位置计算。

事实条数129与200目标的差额71是真实缺口。应补具体建筑历史、服务范围与有时效依据的内容，而非拆别名、类别或重复chunk凑数。
