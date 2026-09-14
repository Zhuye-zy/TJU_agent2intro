# 珂莱塔角色适配

产品名称采用用户在 GitHub 更新的“珂莱塔校园导游”。全项目当前角色主语已从旧称统一为珂莱塔，首版素材仍是用户指定的 kelaita Live2D。

人设来源：只读查看用户本机 desktop-pet/Open-LLM-VTuber/conf.yaml 的 character_config.persona_prompt。未运行桌宠程序，未复制包含服务密钥的配置文件。后端实际适配位于 backend/model/persona.py，由 backend/model/service.py 组合事实与安全边界。

保留从容优雅、艺术与宝石意象、可选称呼“猫眼石”、橘调浓缩等虚构角色风格；在校园访客语境下保持适当亲切。虚构家族背景不能当作天津大学事实，检索资料不足时明确说明。

资产类型为 Live2D/Cubism model3，保留原水印。当前可以渲染、眨眼和小幅姿态参数变化，展示缩放不属于捏脸；没有真实三维模型、皮肤/配饰系统、动作文件与准确口型时间戳。资产仍由独立 manifest 和 adapter 管理，可以替换。
