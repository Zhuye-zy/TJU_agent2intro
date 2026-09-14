# M1 集成记录

主目录 E:\AI4TJU，集成分支 integration/m0，远程 https://github.com/xxwan320/TJU_agent2intro.git。
共同基线 m0-bootstrap = 7706f0c05b1854c676678a1f0704e6ae0295d616；协调提交 40c172e8b4f0d6473ca78a7d463bde8e3b7b0506。

|顺序|窗口/分支|待集成提交|检查|
|---|---|---|---|
|1|D / work/knowledge|9009033732a3d14a398282b4237f81a367bd779c|干净，变更均在 D 范围|
|2|C / work/api|12d877f001ce8290e3c94b79f01229a219441ac8|干净，变更均在 C 范围|
|3|B / work/avatar|6150e5bda0784a4cf08a97840c7b25d14e08ed0c|干净，变更均在 B 范围|
|4|A / work/ui|4ca7bcfcdef79effc7d13ef8f721ae13f0794e1f|干净，变更均在 A 范围|

已读取各分支 handoff、所有权、契约、并行规则及 requests。用户已明确确认 A/B/C/D 均停止修改，可以合并。冻结以上提交，后续提交不会未经检查混入。

提交审计：2026-09-14，所有本地 refs 可达的 6 个提交、150 个唯一 blob。禁止追踪路径/原始音频日志 0 处，高置信凭据模式 0 处。只记录位置和计数，不输出秘密。模式扫描不等于对任意形式秘密的绝对保证；同时人工核对配置、测试和新增文件。根 .env 仍被忽略，不进入推送。

公共阻塞：A/B 的 Vite fs.allow 相对 root 解析导致 403，M 改成基于配置文件的绝对 frontend/shared 路径。C/D/B 的 health 状态、共享旧 stub 测试和生产同源装配在合并后统一更新。无新增依赖请求，保留两份锁文件。

用户要求当前产品角色统一为珂莱塔。人物仍为指定 kelaita Live2D，校园导游定位及事实约束不变。角色语气参考本机桌宠 conf.yaml 的 character_config.persona_prompt；只摘取角色设定，不复制包含服务凭据的配置文件。

合并完成：D 71bc9dc → C d0f6404 → B 5ecc4df → A 1715664；B 推送期间远程 README 标题提交 1b07934 已通过 290645b 保留合并，无强推。每项合并均已推送。
