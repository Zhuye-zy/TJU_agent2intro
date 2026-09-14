# 第三方来源与许可记录

本仓库M0为成熟组件组合，不将OLV-Web UI/hooks用于应用实现（research快照仅作审查证据），不导入OLV/AIRI完整应用。原项目名、版本与来源在docs/OPEN_SOURCE_DECISION.md；安装解析以package-lock.json/uv.lock为准，直接依赖实际许可证清单及原文位于docs/DEPENDENCY_LICENSES.json、docs/licenses/。本文不是给第三方资产重新授权。

## 实际直接依赖

- React/React DOM、Vite及React插件、TypeScript、PixiJS：保留安装包许可证。
- pixi-live2d-display 0.4.0（Guan，MIT），入口pixi-live2d-display/cubism4；所用PixiJS 6.5.10。MIT不覆盖Cubism Core。
- @ricky0123/vad-web 0.0.31：ISC；Silero ONNX模型另为MIT，onnxruntime-web另按其许可证。仅活动检测，不能声称这是ASR。
- FastAPI、Uvicorn、Pydantic/Pydantic Settings、HTTPX、OpenAI Python SDK、LangGraph按安装包许可证；SDK只用于指定GLM/独立ASR服务适配，不改变供应商。
- edge-tts 7.2.8：LGPL-3.0，作为未修改的独立Python依赖保留原许可与源码链接：https://github.com/rany2/edge-tts 。M0未打包独立可执行文件或修改该库；后续分发应保留适用材料。
- LangGraph 1.2.11：MIT；直接运行固定 intent→retrieval→answer→scene_action 工作流，未开启 LangSmith 追踪。测试/dev依赖也列入清单。

## 独立运行时与素材（本机复制，不进入Git）

Cubism Core取自已审查的上游固定提交，未复制该仓库UI代码：
https://github.com/Open-LLM-VTuber/Open-LLM-VTuber-Web/blob/d176e7df2366952e3bacbf12cf9a8b18a4315932/src/renderer/WebSDK/Core/live2dcubismcore.min.js

SHA256：942783587666a3a1bddea93afd349e26f798ed19dcd7a52449d0ae3322fcff7c。
独立原文docs/research/olv-web-src_renderer_WebSDK_Core_LICENSE.md；Framework原文也保留在research中。Core保留原版权头，属于Live2D专有条款，不能统一标MIT。只准备本机运行资源，B 已验证 Live2D 兼容性；M1 的 HTTP/哈希验证通过，合并后现场画面仍待浏览器验收。

kelaita源目录：
C:\Users\ASUS\Desktop\desktop-pet\Open-LLM-VTuber\live2d-models\kelaita
由用户选定，仅复制这9个素材文件及README。原角色为鸣潮珂莱塔/BongoCat风格，作为本产品首版珂莱塔展示角色；不冒称原创素材。保留README、水印、文件相对引用；不复制整个桌宠，不运行其程序。未核验人物再分发/商用权利，不导入本地克隆音色。详细清单docs/ASSET_INVENTORY.md。

本机归档在.runtime/asset-source，工作树各复制到frontend/public/assets/kelaita及frontend/public/vendor，均被Git忽略。素材可替换，不成为LLM或知识模块依赖。源码依用户授权推送 GitHub；人物/Core 原文件保持忽略，未部署云应用。

## 审查但未采用源码

OLV后端MIT、OLV-Web附加条件许可、AIRI MIT、TalkingHead MIT、three-vrm MIT、FastAPI模板MIT。其README/源码只读审查不计作本项目实际源码复用。开源对照与固定提交见OPEN_SOURCE_DECISION；不将各自MIT覆盖到第三方模型/SDK。

## R2新增直接依赖

eventsource-parser 4.1.0（MIT）：M的frontend/src/transport/r2.ts导出createParser给A做真实SSE消费；许可证快照见docs/licenses/eventsource-parser/LICENSE。当前UI尚未调用流端点，不宣称页面流已实现。
@amap/amap-jsapi-loader 1.0.1：发布包package.json声明MIT，已安装供A按需加载JSAPI2.0及Geolocation插件；发布包没有单独LICENSE文本，保存PACKAGE_METADATA.json并记录此缺口，不能将其MIT元数据扩大为高德在线服务/底图/厂商POI许可。在线平台条款和来源限制单独适用。
