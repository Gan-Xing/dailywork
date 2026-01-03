# Repository Guidelines

## Project Structure & Module Organization
Centralized planning lives in `docs/` (`PROJECT_PLAN.md`, `PROMPT_GUIDE.md`, `schema-fields.md`)—treat those files as the canonical contract before writing code. When scaffolding the Next.js app, place route handlers, Server Actions, and UI in `app/`, cross-cutting helpers (AI prompt builders, validation, logging) in `lib/`, and database schema plus migrations in `prisma/`. Keep automated AI prompts or sample payloads alongside each feature (for example `app/daily-report/prompt.md`) and mirror any schema adjustments back into `docs/schema-fields.md` so field definitions never drift.

## Build, Test, and Development Commands
- `npm install` – bootstrap dependencies, including Next.js, Prisma/Drizzle, and testing stacks.
- `npm run dev` – launch the local Next.js server; export `DATABASE_URL=postgres://localhost:5432/daily_report` beforehand so server actions reach Postgres.
- `prisma migrate deploy` – apply migrations in non-dev environments (do not run `npx prisma migrate dev`).
- 绝对不要使用 `npx prisma migrate dev`，绝对不能执行 `npx prisma migrate dev`，把这部分留给我自己处理，我只需要执行 `prisma migrate deploy`，dev 会有删除数据库的风险，绝对不能做！
- Never run `npx prisma migrate dev`; leave this to the user and use `prisma migrate deploy` only because `dev` can reset or delete data.
- `npm run lint` – execute ESLint + Prettier checks; fix violations before committing.
- `npm run test` – run the unit/integration suite (Vitest or Jest); add `--runInBand` if Postgres-backed tests need serialized execution.

## Coding Style & Naming Conventions
Write TypeScript everywhere (no loose `.js` files) with 2-space indentation and trailing commas so Prettier can keep diffs clean. Use PascalCase for React components, camelCase for hooks/utilities, and SCREAMING_SNAKE_CASE for environment variables. Server Actions that mutate data should be suffixed with `Action` (e.g., `createReportAction`), and API routes should follow kebab-case folders under `app/api`. Run `npm run lint -- --fix` before pushing to ensure style parity.

## Testing Guidelines
Unit tests belong next to the module in `__tests__` directories, while API/DB integration specs go under `tests/`. Mirror field names from `docs/schema-fields.md` in fixtures so schema misalignments surface quickly. Maintain ≥80% statement coverage via `npm run test -- --coverage` and document any temporary gaps in the PR description. Snapshot tests should cover AI prompt builders to prevent accidental rewrites; update snapshots only after verifying the spec change in `docs/`.

## Commit & Pull Request Guidelines
Use Conventional Commits (`feat:`, `fix:`, `chore:`) written in the imperative mood; include scope names such as `feat(app): add weather form` to signal ownership. Every PR must reference the plan items it touches, summarize schema or AI prompt changes, and attach UI screenshots or terminal output for test runs. If a change alters `docs/`, link directly to the affected headings so reviewers can confirm the documentation remains the source of truth.

## Security & Configuration Tips
Never commit `.env` or database dumps; rely on `.env.local` for local overrides and describe required keys (`OPENAI_API_KEY`, `DATABASE_URL`) inside `docs/PROJECT_PLAN.md`. When sharing seed data, strip personal or project-sensitive identifiers before placing them in `tests/fixtures`. Rotate API keys referenced in CI whenever credentials appear in issue trackers or PR logs.
