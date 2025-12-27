# Daily Report Platform Plan

## 1. 当前目标
- 用网页替代 Excel 日报：工长在线填写、保存历史。
- 通过 AI 对原始日报做润色和项目级汇总，减少人工编辑。
- 所有数据托管在 Supabase Postgres（云端托管版本），同时保留原有权限与内网导出策略。
- 新增“成员管理”模块：成员信息/角色/权限维护，主页增加 `/members` 入口，支持中法双语与导入导出。

## 2. 技术基线
- 前端/后端：Next.js（App Router + Server Actions 或 API Routes 即可）。
- 数据库：Supabase Postgres（生产/预发共用），通过 Prisma 进行 schema 管理与迁移。
- AI：服务端调用（OpenAI/自建模型均可），在写 DB 后触发润色与汇总。
- 环境变量：`.env.local` 提供 `DATABASE_URL`（Supabase 连接池端点，对应 `POSTGRES_PRISMA_URL`）、`DIRECT_DATABASE_URL`（Supabase 非连接池端点 `POSTGRES_URL_NON_POOLING`，供 Prisma 迁移使用）以及 `DEEPSEEK_API_KEY`（DeepSeek Chat Key）。
- 包管理器：统一使用 `pnpm`，本地与 CI 均不要使用 `npm`/`yarn` 以免锁文件漂移。
- 构建约定：所有服务器/Vercel 构建在运行 `next build` 前必须执行 `prisma generate`（现由 `pnpm run build` 自动完成），以避免缓存造成的旧版 Prisma Client。
- 部署：本地/预发统一连到 Supabase；正式环境可在 Vercel/自托管 Node 上运行，仍复用 Supabase 数据库。

## 3. 待确认输入
1. 日报字段清单：包含字段名、类型、是否必填、分组（例：施工进度、安全、材料）。
2. 用户与流程：谁能填？是否需要账号/审批？是否允许修改历史日报？
3. AI 规则：润色边界、语言风格、摘要模板、是否要中英双语。
4. 汇总需求：按照项目/日期/班组展示？需不需要导出 Excel/PDF？
5. 环境信息：操作系统、Postgres 版本、现有 Next 项目与否、可用的 OpenAI Key。

> 每拿到一项信息，就更新本文件的“待确认输入”或新开“已确定”小节，保持同步。

## 4. 实施步骤（保持顺序执行）
1. **字段结构化**：把 Excel 内容整理成 JSON/表格定义，沉淀到 `/docs/schema-fields.md`（待创建）。
2. **数据库设计**：根据字段定义排出数据模型和迁移脚本。
3. **表单与接口**：Next.js 页面 + API/Server Action，支持工长录入与校验。
4. **AI 处理链路**：提交后写入 DB，并调用 AI 生成润色文本 + 项目摘要，存专表。
5. **汇总与导出**：项目视角的日报列表、搜索、导出（CSV/Excel）。
6. **验收与交付**：联调流程、QA、文档更新（本文件 + 操作指南）。

## 5. 文档协作约定
- 变更需求或决策后，优先更新本文件对应章节。
- 新增具体设计/接口，放在 `docs/` 下独立文件，并在此处加链接。
- 开发按步骤推进，每完成一大步就补充“实施步骤”的进度标记（勾/日期）。

## 6. 预期最终效果
- 工长在网页端快速填写日报，自动校验必填项。
- 系统后台自动润色、生成项目级摘要，形成可检索的日报库。
- 管理端可按项目/时间导出报表，完全替代当前 Excel 流程。

## 7. 财务模块（记账）草案
- 目标：提供项目级别的流水记账，支持序号自动生成与基础筛选，为后续财务报表做准备。
- 核心字段（单行记录）：序号（自动）、项目选择、事由、分类、金额、单位、支付类型、支付状态、支付日期、备注、TVA 税费。
- 需求范围：一条记录即一行，支持增删改查；分类、支付类型需可维护；金额含税标记依赖 TVA 字段。
- 入口：在首页增加“财务记账”入口链接至 `/finance`，作为第三个核心模块。

## 8. 成员管理模块草案
- 目标：集中维护用户共享字段 + 中方扩展字段、角色与权限映射，支持导入/导出与审计；沿用现有 RBAC（用户-角色、角色-权限多对多，权限为资源-动作编码）。
- 页面：成员信息（列表/筛选/详情/编辑，中方扩展字段可选）、角色管理（角色定义 + 关联用户/权限）、权限管理（权限名称/描述/编码维护）、工资发放（每月两次批次录入 + 月度报表）。
- 数据与规则：国籍、岗位自由填；手机号数组不区分主次；在职状态为在职/离职/休假，离职需记录日期与原因（详情展示）；红皮书年限与累计出国年限按年自动递减/递增；中法双语 UI；国籍列表可由管理员 CRUD。
- 入口：主页新增“成员管理”卡片指向 `/members`；详情及字段定义详见 `docs/member-management.md` 与 `docs/schema-fields.md`。

## 9. 产值计量模块草案
- 目标：结合进度分项的设计/完成量与单位价格，为财务与项目管理提供实时的产值进度看板，并辅以完成率参考值。
- 数据与规则：基于 `progress` 聚合数据（分项名称、设计量、完成量、单价与完成百分比），后续若新增字段请同步更新 `docs/schema-fields.md`。
- 入口：主页“入口卡片”新增“产值计量”模块，链接 `/value`，与其他核心入口保持同样的视觉与权限体验（需“进度查看”权限）。
- 价格维护：新增 `/value/prices` 页面，允许按分项定义录入多个“可报价分项名称”（如涵洞的混凝土/模板/钢筋），每个名称绑定规格、计价说明与单价。界面支持增删改查：多规格但同价的分项可只维护默认价（`spec` 为空），需要拆分构件/规格（如涵洞）则创建附加条目，产值统计优先匹配 `phaseDefinitionId+spec`，再回退默认价格，需“进度编辑”权限。

## 11. 文档管理模块（提交单/Bordereau Phase 1）

- 范围：仅做提交单线上填充/保存/筛选/导出 PDF（其他文档类型先占位）。
- 现状适配：
  - 报检绑定：报检记录仅存 `documentId`（兼容 `submissionId` 别名），可选 `submissionNumber` 查 Submission 取 `documentId` 绑定；未提供则留空，不再自动创建 Document/Submission。
  - 模板：已存在 `/module/bordereau.html` + `/module/bordereau.css`，但内部值是硬编码（无 `{{ }}` 占位符）；同时保留旧版 `module/index.html`（含 `{{ NUMERO }}` 等占位符）。建议以 `/module/bordereau.html` 为源，补齐占位符并复制到正式的模板存储（如 `app/documents/templates/bordereau.html`），同时保留原文件以便回溯。
  - 导出：已有 `InspectionModule/generate-pdf.mjs` 可抽成组件重用，优先导出 PDF，暂不新增浏览器打印路由。
  - 审计：沿用 `createdBy/updatedBy/createdAt/updatedAt`，暂不新增事件表。
- 设计落地：字段定义见 `docs/schema-fields.md` 的“文档管理”章节；计划在 Prisma schema 新增 `DocumentTemplate`（或 `SubmissionTemplate`）并扩展 `Submission`。
- 近期任务：解析/存储 HTML 模板、自动生成表单、保存 `Submission.data`、生成/缓存渲染 HTML + PDF 导出；列表筛选基于 `Submission.status`/更新时间。

## 待处理任务
- [ ] API 尚未添加鉴权/多角色保护，后续需要接入登录与访问控制。
- [ ] 编写 Prisma/接口层的自动化测试与数据校验（含输入 schema 校验、防止脏数据）。

## 10. Prisma 迁移策略（操作约束）
- **禁止**在本地/任何环境直接执行 `npx prisma migrate dev`，因为项目依赖的 Supabase 数据库已集中托管，命令会尝试连接 CI/产线的 pooling 端点导致失败或数据不一致。  
- 要应用 schema 变更，请在受控脚本中编写 SQL migration 并由运维在目标数据库上执行，或以 `prisma migrate deploy` + 预先生成的 migration 文件形式在 CI/production 中同步。  
- 本地可以使用 `prisma db pull` 观察结构，但请不要以 `migrate dev` 形式写入远端；所有由我们提交的 schema 变动必须经过复核并在文档中记录（见本文件 Section 8/9 的规则）。
