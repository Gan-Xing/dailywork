import { MACHINE_PAGE_SIZE_OPTIONS } from '@/lib/resources/machines/constants'
import type { ResourcesCopy } from '@/lib/i18n/resources'

export function PaginationBar({
  t,
  totalItems,
  page,
  totalPages,
  pageInput,
  pageSize,
  onPageChange,
  onPageInputChange,
  onPageSizeChange,
}: {
  t: ResourcesCopy
  totalItems: number
  page: number
  totalPages: number
  pageInput: string
  pageSize: number
  onPageChange: (next: number) => void
  onPageInputChange: (next: string) => void
  onPageSizeChange: (next: number) => void
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3 text-sm text-slate-600">
      <span>{t.common.pagination.summary(totalItems, page, totalPages)}</span>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-xs text-slate-500">
          <span className="text-slate-400">{t.common.pagination.pageSizeLabel}</span>
          <select
            value={pageSize}
            onChange={(event) => {
              const value = Number(event.target.value)
              if (!Number.isFinite(value)) return
              onPageSizeChange(value)
            }}
            className="h-8 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:border-sky-400 focus:outline-none"
            aria-label={t.common.pagination.pageSizeLabel}
          >
            {MACHINE_PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="rounded-xl border border-slate-200 px-3 py-1 text-xs text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-40"
          disabled={page <= 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
        >
          {t.common.pagination.prev}
        </button>
        <div className="flex items-center gap-1 text-xs text-slate-600">
          <input
            type="number"
            min={1}
            max={totalPages}
            value={pageInput}
            onChange={(event) => onPageInputChange(event.target.value)}
            onBlur={() => {
              const value = Number(pageInput)
              if (!Number.isFinite(value)) {
                onPageInputChange(String(page))
                return
              }
              const next = Math.min(totalPages, Math.max(1, Math.round(value)))
              if (next !== page) onPageChange(next)
              onPageInputChange(String(next))
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                const value = Number(pageInput)
                const next = Number.isFinite(value)
                  ? Math.min(totalPages, Math.max(1, Math.round(value)))
                  : page
                if (next !== page) onPageChange(next)
                onPageInputChange(String(next))
              }
            }}
            className="h-8 w-14 rounded-lg border border-slate-200 bg-white px-2 py-1 text-center text-xs text-slate-700 focus:border-sky-400 focus:outline-none"
            aria-label={t.common.pagination.goTo}
          />
          <span className="text-slate-400">/ {totalPages}</span>
        </div>
        <button
          type="button"
          className="rounded-xl border border-slate-200 px-3 py-1 text-xs text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-40"
          disabled={page >= totalPages}
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        >
          {t.common.pagination.next}
        </button>
      </div>
    </div>
  )
}

