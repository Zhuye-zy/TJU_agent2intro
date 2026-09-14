# AI4TJU M0 预检（未完成 bootstrap）

检查日期：2026-09-14。目标：`E:\AI4TJU`。产品是数字人校园导游；desktop-pet 仅作形象来源。用户随后明确首版使用 `kelaita`，该素材选择已确定，运行器仍须可替换。素材身份无需再次询问；原始角色来源与再分发许可边界须保留。

## 当前阻塞

用户要求先读提示词包第 0—2 节并遵守 1.3、2.1；本轮消息未附这些章节，项目空目录，已检查的桌面、Downloads、Documents 近邻也未找到。已向用户请求本机路径或章节正文。在核对前不冻结主路线、依赖、接口或工作树基线。本文件不表示 BOOTSTRAP_READY。

## 本机检查

- `E:\AI4TJU` 存在，为普通空目录，非链接；无项目、隐藏配置、锁文件或未提交内容。
- `git -C E:\AI4TJU rev-parse --show-toplevel` 和 `git -C E:\ rev-parse --show-toplevel` 均返回非仓库；没有把父仓库当作项目。
- `E:\AGENTS.md` 不存在，空项目内没有 AGENTS.md；主控工作目录的 C:\、C:\Users、C:\Users\ASUS 层级没有 AGENTS.md。
- Node `v24.19.0`，npm `12.0.2`，Git `2.55.0.windows.3`。npm registry 为 `https://registry.npmjs.org/`。
- 默认 Python `3.13.13`（Conda），`py -0p` 另列 `D:\Program Files\Python311\python.exe` 和 `C:\Python314\python.exe`。Python 3.11 可用于 OLV 的 `<3.13` 约束，尚未建立虚拟环境或验证安装。
- PATH 中未发现 pnpm、yarn、uv。
- 已读取现有 Git 用户身份，未修改任何全局配置。
- 端口 `5173,5174,5175,5176,5177,8000,8001,8002,8003,8004` 检查时均未监听；仅为候选，尚无服务或工作树端口承诺。
- 项目 `.env` 不存在。进程 `GLM_API_KEY`、`ZHIPUAI_API_KEY` 均未配置。通用 `OPENAI_API_KEY` 存在但没有输出值或采用；不等于指定 GLM 已配置。
- `glm_key_configured: false`，`model_verified: false`，`application_online: false`。

## 已进行和未进行

已进行环境只读检查、官方开源资料/少量源码只读审查、本地素材只读盘点。没有执行 desktop-pet 程序，没有复制人物或音色素材，没有 clone 大型项目，没有创建云远程或发布，没有初始化代码或创建分支/工作树。

尚无构建证据、BASE_COMMIT、四窗口真实工作树表。补齐提示词包后继续 M0，而非直接进入 A/B/C/D 实现。

## 补齐后执行顺序

1. 阅读缺失的第 0—2 节，对照审查报告确定单一主路线。
2. 在目标目录完成底座、来源/许可证、锁文件与配置；按现有 Git 身份初始化。
3. 冻结 OWNERSHIP、CONTRACTS，建立最小可编译 stub，不提前完成业务。
4. 安装依赖并实际构建/启动/检查 health 和未实现响应。
5. 提交 bootstrap，记录共同 BASE_COMMIT，创建四个隔离工作树及 PARALLEL_RUN。

GLM 接入资料已实际查阅官方 [OpenAI API 兼容文档](https://docs.bigmodel.cn/cn/guide/develop/openai/introduction)。文档支持通过服务端 SDK 的 base_url、api_key 配置接入；本任务所指定的具体模型、网关仍须核对提示词包，未擅自选择。
