# Daily Report Platform Plan

## 1. 当前目标
- 用网页替代 Excel 日报：工长在线填写、保存历史。
- 通过 AI 对原始日报做润色和项目级汇总，减少人工编辑。
- 所有数据托管在 Supabase Postgres（云端托管版本），同时保留原有权限与内网导出策略。

## 2. 技术基线
- 前端/后端：Next.js（App Router + Server Actions 或 API Routes 即可）。
- 数据库：Supabase Postgres（生产/预发共用），通过 Prisma 进行 schema 管理与迁移。
- AI：服务端调用（OpenAI/自建模型均可），在写 DB 后触发润色与汇总。
- 环境变量：`.env.local` 提供 `DATABASE_URL`（Supabase 连接池端点，对应 `POSTGRES_PRISMA_URL`）、`DIRECT_DATABASE_URL`（Supabase 非连接池端点 `POSTGRES_URL_NON_POOLING`，供 Prisma 迁移使用）以及 `DEEPSEEK_API_KEY`（DeepSeek Chat Key）。
- 构建约定：所有服务器/Vercel 构建在运行 `next build` 前必须执行 `prisma generate`（现由 `npm run build` 自动完成），以避免缓存造成的旧版 Prisma Client。
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

## 待处理任务
- [ ] API 尚未添加鉴权/多角色保护，后续需要接入登录与访问控制。
- [ ] 编写 Prisma/接口层的自动化测试与数据校验（含输入 schema 校验、防止脏数据）。
