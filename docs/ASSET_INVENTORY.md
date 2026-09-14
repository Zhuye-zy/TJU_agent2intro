# desktop-pet 只读素材盘点

盘点日期：2026-09-14。范围：`C:\Users\ASUS\Desktop\desktop-pet`。只读取目录、README、许可证、资源 manifest 与 PNG 文件头；未运行其中程序、模型或脚本，未修改、复制素材。此报告是 M0 预检资料，不代表 M0 已完成。

## 结论与产品边界

本项目产品是数字人校园导游。desktop-pet 只作为首版人物素材来源；素材格式不决定应用框架。用户在盘点期间明确“形象使用 kelaita”，因此首版形象路线已选定为该 Live2D Cubism 3 资源，人物选择不再构成阻塞。此项用户授权确定使用方向，不等同于第三方素材对外再分发许可。本地原角色明确标记为珂莱塔（Kelaita），必须保留原角色来源，不能把素材本身记为已核验的原创海小棠。

建议冻结可替换 AvatarAdapter、独立 renderer、资源 manifest 与 capabilities，以 kelaita 为首版本机资源接入方向。模型和语音调用归各自模块，人物不直接调用 LLM。M0 可以提供显式未实现的 renderer stub 与资源配置占位；具体渲染实现归 B 窗口。对外分发许可仍未核验，M0 不得把用户选择写成已取得原权利方授权。

## 指令及提示词包检查

- 检查 `C:\AGENTS.md`、`C:\Users\AGENTS.md`、`C:\Users\ASUS\AGENTS.md`、`C:\Users\ASUS\Desktop\AGENTS.md`、`C:\Users\ASUS\Desktop\desktop-pet\AGENTS.md`，均未发现。
- 递归查找 desktop-pet 内 AGENTS.md，未发现。
- 查看桌面文件名及 desktop-pet 内相关文档名，没有找到用户提及的提示词包第 0—2 节、第 1.3 节、第 2.1 节；没有把不相关桌面文档当作该包，也没有扫描整盘。包的正文仍需主控获取。

## 目录与格式

根目录包含 `.claude`、`models`、`Open-LLM-VTuber`、`桌宠程序`。共 569 个文件，339,929,782 字节。该总数包括源码、日志、缓存、程序及模型，并非纯人物素材大小。

可见文件类型包括 PNG 108、JPEG 13、JPG 12、JSON 69、MOC3 6、FLAC 13、WAV 11、ONNX 2、CKPT 1、PTH 1，以及 Python/JS/CSS/HTML/WASM、DLL/EXE。没有发现 `.vrm`、`.glb`、`.gltf`。仅由资源格式确认 Live2D 候选路径，不据此决定前后端框架。

| 资源目录（相对 desktop-pet） | 文件数 | 字节数 | 格式 |
| --- | ---: | ---: | --- |
| `Open-LLM-VTuber/live2d-models/kelaita` | 9 | 3,471,186 | json、moc3、png、txt |
| `Open-LLM-VTuber/live2d-models/mao_pro` | 22 | 9,386,727 | json、moc3、png、txt |
| `Open-LLM-VTuber/live2d-models/shizuku` | 15 | 5,260,001 | json、moc3、png、txt |

这些数量含各自 ReadMe.txt。另有桌宠程序三套模式素材：`桌宠程序/A珂莱塔（启动）/img/standard/cat_model`、`img/keyboard/cat_model`、`img/gamepad/cat_model`。对应 MOC3 是 `cat.moc3`（659,264 字节）、`demomodel2.moc3`（32,128 字节）、`demomodel3.moc3`（496,576 字节）。

## 已读取的珂莱塔 manifest 与 README

真实入口：`C:\Users\ASUS\Desktop\desktop-pet\Open-LLM-VTuber\live2d-models\kelaita\runtime\kelaita.model3.json`。

配套 `live2d-models/kelaita/ReadMe.txt` 明确说明：这是鸣潮珂莱塔的 BongoCat 风格桌宠模型，从 `A珂莱塔（启动）/img/standard/cat_model/` 复制并改名为 kelaita；有桌子、键鼠场景。README 不等同于原创或再分发授权。

- manifest Version 为 3，引用 `kelaita.moc3`、`kelaita.physics3.json`、`kelaita.cdi3.json`。
- 三张纹理为 `kelaita.2048/texture_00.png`（868,542 字节）、`texture_01.png`（1,214,338 字节）、`texture_02.png`（719,266 字节），读取 PNG 文件头确认均为 2048 × 2048。
- 声明 LipSync 参数 `ParamMouthOpenY`、EyeBlink 参数 `ParamEyeLOpen` 与 `ParamEyeROpen`。
- README 说明没有 `.motion3.json`，Idle/Tap motion groups 不可用；依靠参数驱动基础姿态。
- 唯一 `Live2d_expression0.exp3.json` 用于切换水印参数 Param24，不能当作情绪表达；现有 model_dict 的 emotionMap 为空。
- 有嘴形参数不等于已有音素或口型时间戳。未运行验证实际播放、渲染、嘴形同步或打断。

`Open-LLM-VTuber/model_dict.json` 列出 mao_pro、shizuku、kelaita 三个名称；kelaita 描述为“珂莱塔桌宠（BongoCat 风格）”，不含“海小棠”。

## 语音模型候选与边界

`models/gpt-sovits/珂莱塔_ZH/` 含训练日志、`珂莱塔_ZH-e10.ckpt`（155,312,893 字节）、`珂莱塔_ZH_e10_s510_l32.pth`（75,549,998 字节），以及 `reference_audios/中文/emotions/` 下一个参考 WAV（849,890 字节）。仅确认文件存在；未加载模型、播放参考音频、验证音色或推理，也未确认声音来源和授权。不能据此声称 TTS 已可用。

## 来源、版本及许可证据

本地 `Open-LLM-VTuber/README.CN.md` 描述网页/桌面客户端、Live2D、语音打断与多模型适配能力；这是本地 README 的能力声明，不是本次实测结果。该副本根目录没有 `.git`，不能得出实际提交哈希或与远端一致的结论。`pyproject.toml` 实际标注项目版本 `1.2.1`、Python `>=3.10,<3.13`；这些只是本地文件声明。

实际读取：

- `Open-LLM-VTuber/LICENSE`：MIT，Copyright (c) 2025 Yi-Ting Chiu，明确排除 Live2D 样本模型。
- `Open-LLM-VTuber/LICENSE-Live2D.md`：收录 Live2D 样本数据条款及独立素材条款。不能将软件 MIT 解释为所有人物素材的 MIT 授权。
- `Open-LLM-VTuber/live2d-models/kelaita/ReadMe.txt`：给出复制来源和运行参数说明，未发现明确授权文本。
- `桌宠程序/A珂莱塔（启动）/_对软件有使用疑问请先查看教程说明！.txt`：仅重复要求查看压缩包教程，不构成许可。

本报告不提供法律结论；只记录所见许可文件及未核验边界。没有进行远端许可时效核验，也没有确认第三方珂莱塔人物或声音资产可再分发、改名或商用。主控须把代码许可证、Live2D SDK/样本条款、第三方人物与语音资产边界分开记录。

## M0后续状态
提示词包已补齐。主控已把选定kelaita的9个文件复制到项目.runtime/asset-source及本机public目录，未复制或执行桌宠程序。本文前述未复制是只读盘点阶段状态；当前源目录仍未修改，renderer/语音仍未验证。
