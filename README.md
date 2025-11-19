# Daily Work Journal

A Next.js app for collecting daily construction reports with bilingual copy and a structured schema. The homepage lets you create a report for a specific date, review historical entries via a calendar, and jump into the full editor.

## Prerequisites

- Node.js 18.16 (current dev environment)
- PostgreSQL running locally with a database you can access

## Setup

1. Install dependencies
   ```bash
   npm install
   ```
2. Configure the database connection. Copy `.env.example` to `.env` and update `DATABASE_URL` (the current dev instance uses `postgresql://ganxing:Admin1234.@localhost:5432/ganxing?schema=public`).
3. Apply Prisma migrations
   ```bash
   npx prisma migrate dev
   ```

## Development

Run the dev server:
```bash
npm run dev
```
Visit `http://localhost:3000` for the dashboard. Creating or editing a report will read/write through the `/api/reports` endpoints backed by Postgres.

## Useful Commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start Next.js locally |
| `npm run build` | Production build |
| `npm run lint` | ESLint checks |
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
