# Daily Work Journal

A Next.js app for collecting daily construction reports with bilingual copy and a structured schema. The homepage lets you create a report for a specific date, review historical entries via a calendar, and jump into the full editor.

## Prerequisites

- Node.js 18.18+ (Next.js 14 requirement; align local runtime with production)
- A Supabase project with Postgres enabled (pooling + non-pooling URLs available)
- Package manager: `pnpm` (use pnpm commands; npm is not used in this repo)

## Setup

1. Install dependencies
   ```bash
   pnpm install
   ```
2. Configure the database connection. Copy `.env.example` to `.env.local` and fill in:
   - `DATABASE_URL` → Supabase `POSTGRES_PRISMA_URL` (pgBouncer 6543 endpoint, used by the running app)
   - `DIRECT_DATABASE_URL` → Supabase `POSTGRES_URL_NON_POOLING` (5432 endpoint, used by Prisma for migrations)
3. Apply Prisma migrations to Supabase
   ```bash
   npx prisma migrate deploy
   ```
   > `prisma/schema.prisma` is already wired with `directUrl`, so `migrate deploy` will automatically open the non-pooling connection. For new schema changes, run `npx prisma migrate dev --name <change>` locally, check in the migration, then redeploy with the command above.

## Development

Run the dev server:
```bash
pnpm run dev       # Turbopack (faster; default)
# If you hit a Turbopack compatibility issue, fall back to:
pnpm run dev:webpack
```
Visit `http://localhost:3000` for the dashboard. Creating or editing a report will read/write through the `/api/reports` endpoints backed by Postgres.

## Useful Commands

| Command | Description |
| --- | --- |
| `pnpm run dev` | Start Next.js locally |
| `pnpm run build` | Production build (automatically runs `prisma generate` first so Vercel caches stay fresh) |
| `pnpm run lint` | ESLint checks |
| `npx prisma studio` | Inspect the Postgres data via Prisma Studio |

## API Overview

- `GET /api/reports?month=YYYY-MM` – list all report summaries within a month
- `GET /api/reports?limit=5` – fetch the latest reports
- `GET /api/reports/:date` – fetch the full report for a date（若不存在则返回带有上期库存继承的草稿）
- `PUT /api/reports/:date` – create or update the report for that date

> 材料库存的 `current` 字段会由服务端自动计算，并在更新历史日报时级联刷新后续日期的 `previous/current`，确保库存链条一致。

## Next Steps

- Add authentication/authorization before exposing the APIs in shared environments.
- Hook in the AI post-processing pipeline once backend storage requirements are finalized.
