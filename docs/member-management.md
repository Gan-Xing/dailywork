# 成员管理模块设计

## Scope 与入口
- 模块：成员管理（含 Member、Role、Permission 三个子页面），沿用现有资源-动作权限体系。
- 入口：主页新增“成员管理”卡片，链接 `/members`，支持中/法双语标签与简介。
- 目标：统一维护中方/外籍员工信息、角色与权限映射，支持导入导出与基础审计。

## 页面与能力
- 成员信息（Member）：列表 + 筛选（角色、状态、国籍、岗位），支持搜索姓名/账户名；详情/编辑包含共享字段与扩展字段；岗位选项来自现有成员岗位去重下拉，可手动新增。
- 角色管理（Role）：维护角色定义，绑定用户与权限（用户-角色、角色-权限均多对多）。
- 权限管理（Permission）：维护权限定义（名称、描述、编码），显示关联角色；权限列表遵循现有资源-动作模型。
- 导入/导出：成员信息支持 Excel/CSV 导入导出（模板需包含必填共享字段，扩展字段可选）；导入需校验必填、手机号格式与角色存在性。
- 审计：记录 `createdAt/updatedAt` 自动时间戳，`createdBy/updatedBy` 用户；操作日志记录导入/批量更新。

## 数据模型概览
- `User`（主表/共有字段）
  - 基础：`id`、`name`、`gender?`、`nationality`（自由填）、`phones`（string[]，不区分主次、不强制国家码）、`joinDate`（date）、`birthDate`（date，必填；中方可由身份证解析补全，身份证仍可选）。
  - 职务与状态：`position`（自由文本，岗位可由管理员新增）、`employmentStatus`（枚举：在职 `ACTIVE` / 离职 `TERMINATED` / 休假 `ON_LEAVE`），`terminationDate?`、`terminationReason?`。
  - 账号：`username`、`passwordHash`（仅存储哈希，沿用现有账户体系）。
  - 关联：`roles` 多对多（用户-角色）；`createdAt/updatedAt`、`createdBy/updatedBy`。
- `UserChineseProfile`（仅中方）
  - 身份：`frenchName`、`idNumber`、`passportNumber`。
  - 教育/资质：`educationAndMajor`、`certifications`（string[]，名称即可）。
  - 联系：`domesticMobile`、`emergencyContactName`、`emergencyContactPhone`。
  - 其他：`redBookValidYears`（整数，手动输入；每个自然年末递减，至 0 为止）、`cumulativeAbroadYears`（手动输入，2025-12-31 之后每年自动 +1）、`birthplace`、`residenceInChina`、`medicalHistory`、`healthStatus`。
- `UserExpatProfile`（当地员工/外籍扩展）
  - 组织与合同：`team`（EQUIPE 班组）、`contractNumber`（MATRICULE 合同编号，唯一）、`contractType`（枚举：`CTJ` / `CDD`）。
  - 薪资：`salaryCategory`（CATEGORIE 工资等级）、`baseSalaryAmount` + `baseSalaryUnit`（SALAIRE DE BASE 金额与单位）、`netMonthlyAmount` + `netMonthlyUnit`（NET MENSUEL 实发工资与单位，仅月）。
  - 个人情况：`maritalStatus`（婚姻状态）、`childrenCount`（子女数量）。
  - CNPS：`cnpsNumber`（NUMERO CNPS）、`cnpsDeclarationCode`（CODE DE DECLARATION CNPS）。
  - 其他：`provenance`（PROVENANCE 属地/来源）、`emergencyContactName` + `emergencyContactPhone`（EN CAS D'URGENCES 紧急联系人与电话）。
- `Role` / `Permission`
  - 沿用现有 RBAC：用户-角色多对多，角色-权限多对多；权限以资源-动作编码存储（示例 `member:view`、`member:create`、`member:update`，兼容旧 `member:edit`/`member:manage`）。

## 业务与交互要点
- 账号/密码：仅存储哈希；复用现有登录/重置流程，避免重复实现认证。
- 日期精度：入职日期、红皮书有效年限使用日期/年级别选择器，无时区要求。
- 离职信息：离职日期/原因仅在详情页展示，不在列表列出。
- 自动计算：每年跨过 12-31 时，`cumulativeAbroadYears` 自动 +1；`redBookValidYears` 自动 -1，不低于 0。
- 中法双语：文案使用现有 i18n 体系（中/法）；国籍使用固定双语列表（中国 + 西非 12 个、中非 8 个、东非 5 个、南部非洲 4 个）。
- 表单规则：性别仅男/女（默认男），入职日期默认当天，电话为字符串数组；岗位在表单下拉中展示去重后的现有岗位，可手输新增。
- 敏感信息：暂无额外加密/脱敏要求，可依赖权限控制访问。
- 筛选/排序：成员列表至少支持按角色、状态、国籍、岗位过滤，支持姓名/账号搜索、入职时间排序。

## 权限策略
- 权限编码：`member:view|create|update|delete`、`role:view|create|update|delete`、`permission:view|update`（保留 `member:edit`、`member:manage`、`role:manage` 兼容）；日报 `report:view|edit`；文档管理 `submission:view|create|update|delete|manage`、`template:view|create|update|delete`；道路/进度/报检 `road:view|manage`、`progress:view|edit`、`inspection:create`；财务 `finance:view|edit|manage`；产值计量 `value:view|create|update|delete`；开发路线 `roadmap:view|create|update|delete`。
- 归档权限：`Permission.status=ARCHIVED` 后不再参与鉴权，也不可绑定到角色。
- 默认角色：Admin 拥有全部；Employee 拥有 `road:view`、`progress:view`、`inspection:create`、`report:view`、`report:edit`、`finance:view`。
- API 护栏：成员/角色/权限的读写需对应权限（成员读 `member:view`，成员写 `member:create|member:update|member:delete`；角色读 `role:view`，角色写 `role:create|role:update|role:delete`；权限读 `permission:view`，编辑权限状态需 `permission:update`；兼容旧 `member:edit|member:manage|role:manage`）；道路/进度读取需要 `road:view` 或 `progress:view`，进度写入需要 `progress:edit` 或 `road:manage`；报检需要 `inspection:create`；日报读取/写入分别需要 `report:view` / `report:edit`；开发路线访问需 `roadmap:view`，新增或状态调整需 `roadmap:create|roadmap:update`。

## 后续扩展留口
- 外籍扩展字段：预留 `UserExpatProfile`，后续新增字段保持后向兼容。
- 报警/提醒：后续可基于红皮书年限、累计出国年限增加提醒或报表。
- 导入模板：可在 UI 下载 CSV/Excel 模板，包含共享字段与中方扩展字段示例。
