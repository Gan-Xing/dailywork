'use client'

import type React from 'react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Option = { value: string; label: string }

type Props = {
  query: Record<string, unknown>
  templates: { id: string; name: string }[]
  creators: { id: number; username: string; name: string | null }[]
  statusList: string[]
  submissionNumbers: number[]
}

const STATUS_OPTIONS: Option[] = [
  { value: 'DRAFT', label: '草稿' },
  { value: 'FINAL', label: '完成' },
  { value: 'ARCHIVED', label: '归档' },
]

const parseSet = (input: unknown) => {
  if (!input) return new Set<string>()
  if (input instanceof Set) return new Set(input)
  if (Array.isArray(input)) return new Set(input.map((item) => String(item)))
  if (typeof input === 'string') {
    return new Set(
      input
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    )
  }
  return new Set([String(input)])
}

const buildSearchParams = (params: Record<string, string | string[] | undefined>) => {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined) return
    if (Array.isArray(value)) {
      if (!value.length) return
      value.forEach((item) => search.append(key, item))
    } else if (value !== '') {
      search.set(key, value)
    }
  })
  return search.toString()
}

export default function SubmissionsFilters({ query, templates, creators, statusList, submissionNumbers }: Props) {
  const router = useRouter()
  const [statusOpen, setStatusOpen] = useState(false)
  const [templateOpen, setTemplateOpen] = useState(false)
  const [creatorOpen, setCreatorOpen] = useState(false)

  const [statusSelected, setStatusSelected] = useState<Set<string>>(() => parseSet(query.status ?? statusList))
  const [templateSelected, setTemplateSelected] = useState<Set<string>>(() => parseSet(query.templateId))
  const [creatorSelected, setCreatorSelected] = useState<Set<string>>(() => parseSet(query.createdBy))
  const [submissionInput, setSubmissionInput] = useState(
    submissionNumbers.length ? submissionNumbers.join(',') : '',
  )
  const [searchInput, setSearchInput] = useState(typeof query.search === 'string' ? query.search : '')
  const [updatedFrom, setUpdatedFrom] = useState(typeof query.updatedFrom === 'string' ? query.updatedFrom : '')
  const [updatedTo, setUpdatedTo] = useState(typeof query.updatedTo === 'string' ? query.updatedTo : '')

  const toggleValue = (set: Set<string>, value: string) => {
    const next = new Set(set)
    if (next.has(value)) next.delete(value)
    else next.add(value)
    return next
  }

  const applyFilters = () => {
    const params = buildSearchParams({
      status: Array.from(statusSelected),
      templateId: Array.from(templateSelected),
      createdBy: Array.from(creatorSelected),
      submissionNumber: submissionInput
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
      updatedFrom: updatedFrom || undefined,
      updatedTo: updatedTo || undefined,
      search: searchInput || undefined,
    })
    const url = params ? `/documents/submissions?${params}` : '/documents/submissions'
    router.push(url)
  }

  const resetFilters = () => {
    setSearchInput('')
    setSubmissionInput('')
    setUpdatedFrom('')
    setUpdatedTo('')
    router.push('/documents/submissions')
  }

  const renderDropdown = (
    label: string,
    open: boolean,
    setOpen: (value: boolean) => void,
    options: Option[],
    selected: Set<string>,
    setSelected: React.Dispatch<React.SetStateAction<Set<string>>>,
  ) => (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:border-emerald-200 hover:text-emerald-700"
      >
        <span>{label}</span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">{selected.size || '全部'}</span>
      </button>
      {open ? (
        <div className="absolute z-20 mt-2 w-56 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
          <div className="flex items-center justify-between pb-2 text-[11px] text-slate-500">
            <button type="button" onClick={() => setSelected(new Set(options.map((o) => o.value)))} className="rounded-full px-2 py-1 hover:bg-slate-100">
              全选
            </button>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="rounded-full px-2 py-1 hover:bg-slate-100"
            >
              清空
            </button>
          </div>
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {options.map((option) => {
              const checked = selected.has(option.value)
              return (
                <label key={option.value} className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => setSelected((prev: Set<string>) => toggleValue(prev, option.value))}
                    className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-400"
                  />
                  <span className="truncate">{option.label}</span>
                </label>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      {renderDropdown('状态', statusOpen, setStatusOpen, STATUS_OPTIONS, statusSelected, setStatusSelected)}
      {renderDropdown(
        '模版',
        templateOpen,
        setTemplateOpen,
        templates.map((tpl) => ({ value: String(tpl.id), label: tpl.name })),
        templateSelected,
        setTemplateSelected,
      )}
      {renderDropdown(
        '创建人',
        creatorOpen,
        setCreatorOpen,
        creators.map((user) => ({
          value: String(user.id),
          label: user.name || user.username,
        })),
        creatorSelected,
        setCreatorSelected,
      )}
      <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
        <span className="font-semibold">提交单编号</span>
        <input
          value={submissionInput}
          onChange={(e) => setSubmissionInput(e.target.value)}
          placeholder="多编号用逗号分隔"
          className="w-40 rounded-xl border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 placeholder:text-slate-400 focus:border-emerald-300 focus:outline-none"
        />
      </div>
      <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
        <span className="font-semibold">更新时间</span>
        <input
          type="date"
          value={updatedFrom}
          onChange={(e) => setUpdatedFrom(e.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:border-emerald-300 focus:outline-none"
        />
        <span className="text-slate-400">→</span>
        <input
          type="date"
          value={updatedTo}
          onChange={(e) => setUpdatedTo(e.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:border-emerald-300 focus:outline-none"
        />
      </div>
      <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
        <span className="font-semibold">关键词</span>
        <input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="搜索 code / 标题 / 创建人"
          className="w-48 rounded-xl border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 placeholder:text-slate-400 focus:border-emerald-300 focus:outline-none"
        />
      </div>
      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={applyFilters}
          className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-emerald-200/40 transition hover:-translate-y-0.5 hover:shadow-emerald-300/60"
        >
          应用筛选
        </button>
        <button
          type="button"
          onClick={resetFilters}
          className="rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:border-slate-400 hover:bg-slate-100"
        >
          重置
        </button>
      </div>
    </div>
  )
}
