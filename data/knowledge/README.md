# D 数据使用说明

权威运行数据：pois.json（实体）、facts.json（独立事实）、SOURCE_REGISTRY.json（来源）、assets.json（图面/媒体）。documents.json保留旧摘要检索，buildings.json为旧数据兼容输入；对外建筑以canonical POI覆盖，不能分别维护两套相互矛盾的目录。

本轮独立照片为0，manifest保持空。未核验高德经纬度为null；图面坐标不得用于外部导航URL或当前位置计算。

追加核验7个官方来源页后，原子事实201条达到200目标。媒体明确受本机403/429阻塞，已有3张作品许可元数据候选，不能计入可显示照片。
