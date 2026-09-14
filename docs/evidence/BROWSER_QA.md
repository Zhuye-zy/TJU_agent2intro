# 浏览器现场验收：BROWSER_QA_PENDING

M1 实际尝试使用可用工具检查页面，未绕过工具限制：

1. 浏览器连接器 inventory 返回 apps=[]、browsers=[]。
2. 按 computer-use skill 初始化 Windows @oai/sky，list_apps 能找到现有 Chrome 窗口。
3. 尝试打开独立验收标签页时，工具返回：
   “Computer Use has been stopped for this turn because it could not determine the current browser URL on Windows with enough confidence to enforce policy.”
4. 随即停止浏览器输入操作，没有通过其他 UI/调试协议绕过该限制。

没有取得合并版本的真实页面截图，不生成替代截图，不将 B 分支报告当作 M1 浏览器验收。图片文件数：0。

已验证 HTTP 页面、同源 API、资产哈希及构建，不等于实际渲染/播放。待用户按 USER_GUIDE 现场检查：桌面/390px 小屏、珂莱塔展示、中文输入法、真实声音与 speaking 状态、停止/清空/重试、来源和场景卡片、日志导出。截图仅包含本应用区域，避开其他标签页/个人信息。
