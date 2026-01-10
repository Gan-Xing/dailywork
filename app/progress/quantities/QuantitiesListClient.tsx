'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'

import type { MultiSelectOption } from '@/components/MultiSelectFilter'
import { MultiSelectFilter } from '@/components/MultiSelectFilter'
import type { RoadPhaseManagementRow } from '@/lib/phaseItemTypes'

type Props = {
  rows: RoadPhaseManagementRow[]
}

type SortKey =
  | 'road'
  | 'phase'
  | 'template'
  | 'display'
  | 'intervals'
  | 'project'
  | 'updatedAt'

type DisplayRow = RoadPhaseManagementRow & {
  displayLabel: string
  projectKey: string
  projectLabel: string
  updatedDate: string
}

const NO_PROJECT = '__none__'

const displayLabels: Record<string, string> = {
  LINEAR: '延米',
  POINT: '单体',
}

const buildOptions = (options: MultiSelectOption[]) => {
  const map = new Map<string, MultiSelectOption>()
  options.forEach((option) => {
    if (!map.has(option.value)) {
      map.set(option.value, option)
    }
  })
  return Array.from(map.values())
}

const formatUpdatedDate = (value: string) => value.slice(0, 10)

const compareText = (a: string, b: string) =>
  a.localeCompare(b, 'zh-CN', { sensitivity: 'base' })

export default function QuantitiesListClient({ rows }: Props) {
  const [selectedRoads, setSelectedRoads] = useState<string[]>([])
  const [selectedPhases, setSelectedPhases] = useState<string[]>([])
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>([])
  const [selectedDisplays, setSelectedDisplays] = useState<string[]>([])
  const [selectedIntervals, setSelectedIntervals] = useState<string[]>([])
  const [selectedProjects, setSelectedProjects] = useState<string[]>([])
  const [selectedDates, setSelectedDates] = useState<string[]>([])
  const [sortKey, setSortKey] = useState<SortKey>('updatedAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  const rowsWithMeta = useMemo<DisplayRow[]>(
    () =>
      rows.map((row) => {
        const projectKey = row.projectId ? String(row.projectId) : NO_PROJECT
        const projectLabel = row.projectName
          ? row.projectCode
            ? `${row.projectName}（${row.projectCode}）`
            : row.projectName
          : '未绑定项目'
        return {
          ...row,
          displayLabel: displayLabels[row.measure] ?? row.measure,
          projectKey,
          projectLabel,
          updatedDate: formatUpdatedDate(row.updatedAt),
        }
      }),
    [rows],
  )

  const roadOptions = useMemo(
    () =>
      buildOptions(
        rowsWithMeta.map((row) => ({
          value: String(row.roadId),
          label: `${row.roadName}（${row.roadSlug}）`,
        })),
      ).sort((a, b) => compareText(a.label, b.label)),
    [rowsWithMeta],
  )
  const phaseOptions = useMemo(
    () =>
      buildOptions(
        rowsWithMeta.map((row) => ({
          value: row.phaseName,
          label: row.phaseName,
        })),
      ).sort((a, b) => compareText(a.label, b.label)),
    [rowsWithMeta],
  )
  const templateOptions = useMemo(
    () =>
      buildOptions(
        rowsWithMeta.map((row) => ({
          value: row.definitionName,
          label: row.definitionName,
        })),
      ).sort((a, b) => compareText(a.label, b.label)),
    [rowsWithMeta],
  )
  const displayOptions = useMemo(
    () =>
      buildOptions(
        rowsWithMeta.map((row) => ({
          value: row.measure,
          label: row.displayLabel,
        })),
      ).sort((a, b) => compareText(a.label, b.label)),
    [rowsWithMeta],
  )
  const intervalOptions = useMemo(
    () =>
      buildOptions(
        rowsWithMeta.map((row) => ({
          value: String(row.intervalCount),
          label: `${row.intervalCount} 段`,
        })),
      ).sort((a, b) => Number(a.value) - Number(b.value)),
    [rowsWithMeta],
  )
  const projectOptions = useMemo(
    () =>
      buildOptions(
        rowsWithMeta.map((row) => ({
          value: row.projectKey,
          label: row.projectLabel,
        })),
      ).sort((a, b) => compareText(a.label, b.label)),
    [rowsWithMeta],
  )
  const updatedOptions = useMemo(
    () =>
      buildOptions(
        rowsWithMeta.map((row) => ({
          value: row.updatedDate,
          label: row.updatedDate,
        })),
      ).sort((a, b) => b.value.localeCompare(a.value)),
    [rowsWithMeta],
  )

  const filterControlProps = {
    allLabel: '全部',
    selectedLabel: (count: number) => `已选 ${count} 项`,
    selectAllLabel: '全选',
    clearLabel: '清空',
    noOptionsLabel: '暂无选项',
    searchPlaceholder: '搜索',
  }
  const sharedFilterProps = { ...filterControlProps, className: 'w-full text-slate-200' }

  const filteredRows = useMemo(() => {
    return rowsWithMeta.filter((row) => {
      if (selectedRoads.length && !selectedRoads.includes(String(row.roadId))) {
        return false
      }
      if (selectedPhases.length && !selectedPhases.includes(row.phaseName)) {
        return false
      }
      if (selectedTemplates.length && !selectedTemplates.includes(row.definitionName)) {
        return false
      }
      if (selectedDisplays.length && !selectedDisplays.includes(row.measure)) {
        return false
      }
      if (selectedIntervals.length && !selectedIntervals.includes(String(row.intervalCount))) {
        return false
      }
      if (selectedProjects.length && !selectedProjects.includes(row.projectKey)) {
        return false
      }
      if (selectedDates.length && !selectedDates.includes(row.updatedDate)) {
        return false
      }
      return true
    })
  }, [
    rowsWithMeta,
    selectedRoads,
    selectedPhases,
    selectedTemplates,
    selectedDisplays,
    selectedIntervals,
    selectedProjects,
    selectedDates,
  ])

  const sortedRows = useMemo(() => {
    const direction = sortOrder === 'asc' ? 1 : -1
    const sorted = [...filteredRows].sort((a, b) => {
      let result = 0
      switch (sortKey) {
        case 'road':
          result = compareText(a.roadName, b.roadName)
          break
        case 'phase':
          result = compareText(a.phaseName, b.phaseName)
          break
        case 'template':
          result = compareText(a.definitionName, b.definitionName)
          break
        case 'display':
          result = compareText(a.displayLabel, b.displayLabel)
          break
        case 'intervals':
          result = a.intervalCount - b.intervalCount
          break
        case 'project':
          result = compareText(a.projectLabel, b.projectLabel)
          break
        case 'updatedAt':
          result = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
          break
        default:
          result = 0
      }
      if (result === 0) {
        return (a.phaseId - b.phaseId) * direction
      }
      return result * direction
    })
    return sorted
  }, [filteredRows, sortKey, sortOrder])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortKey(key)
    setSortOrder('asc')
  }

  const renderSortIcon = (key: SortKey) => {
    if (sortKey !== key) return <span className="text-[10px] text-slate-400">↕</span>
    return (
      <span className="text-[10px] text-emerald-200">{sortOrder === 'asc' ? '↑' : '↓'}</span>
    )
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="relative mx-auto max-w-6xl px-6 py-14 sm:px-8 xl:max-w-[1500px] xl:px-10 2xl:max-w-[1700px] 2xl:px-12">
        <div className="absolute inset-x-0 top-10 -z-10 h-48 bg-gradient-to-r from-emerald-300/20 via-blue-300/15 to-amber-200/20 blur-3xl" />
        <header className="flex flex-col gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-100">
            分项工程管理
          </p>
          <h1 className="text-4xl font-semibold leading-tight text-slate-50">
            分项工程管理列表
          </h1>
          <p className="max-w-2xl text-sm text-slate-200/80">
            汇总所有路段分项工程，进入详情页维护区间计量与公式配置。
          </p>
          <nav className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-200/80">
            <Link
              href="/"
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 transition hover:border-white/25 hover:bg-white/10"
            >
              首页
            </Link>
            <span className="text-slate-500">/</span>
            <Link
              href="/progress"
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 transition hover:border-white/25 hover:bg-white/10"
            >
              进度管理
            </Link>
            <span className="text-slate-500">/</span>
            <span className="rounded-full border border-white/5 bg-white/5 px-3 py-1 text-slate-100">
              分项工程管理
            </span>
          </nav>
        </header>

        <section className="mt-10 space-y-4">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200/80">
            共 {rowsWithMeta.length} 条分项工程记录，筛选后 {sortedRows.length} 条
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <MultiSelectFilter
                label="路段"
                options={roadOptions}
                selected={selectedRoads}
                onChange={setSelectedRoads}
                {...sharedFilterProps}
              />
              <MultiSelectFilter
                label="分项名称"
                options={phaseOptions}
                selected={selectedPhases}
                onChange={setSelectedPhases}
                {...sharedFilterProps}
              />
              <MultiSelectFilter
                label="模板"
                options={templateOptions}
                selected={selectedTemplates}
                onChange={setSelectedTemplates}
                {...sharedFilterProps}
              />
              <MultiSelectFilter
                label="显示方式"
                options={displayOptions}
                selected={selectedDisplays}
                onChange={setSelectedDisplays}
                {...sharedFilterProps}
              />
              <MultiSelectFilter
                label="区间数"
                options={intervalOptions}
                selected={selectedIntervals}
                onChange={setSelectedIntervals}
                {...sharedFilterProps}
              />
              <MultiSelectFilter
                label="项目"
                options={projectOptions}
                selected={selectedProjects}
                onChange={setSelectedProjects}
                {...sharedFilterProps}
              />
              <MultiSelectFilter
                label="更新时间"
                options={updatedOptions}
                selected={selectedDates}
                onChange={setSelectedDates}
                {...sharedFilterProps}
              />
            </div>
          </div>
          <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/5">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-white/5 text-xs uppercase tracking-[0.16em] text-slate-300">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      <button
                        type="button"
                        onClick={() => handleSort('road')}
                        className="flex items-center gap-2 text-left"
                      >
                        路段
                        {renderSortIcon('road')}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left">
                      <button
                        type="button"
                        onClick={() => handleSort('phase')}
                        className="flex items-center gap-2 text-left"
                      >
                        分项名称
                        {renderSortIcon('phase')}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left">
                      <button
                        type="button"
                        onClick={() => handleSort('template')}
                        className="flex items-center gap-2 text-left"
                      >
                        模板
                        {renderSortIcon('template')}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left">
                      <button
                        type="button"
                        onClick={() => handleSort('display')}
                        className="flex items-center gap-2 text-left"
                      >
                        显示方式
                        {renderSortIcon('display')}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left">
                      <button
                        type="button"
                        onClick={() => handleSort('intervals')}
                        className="flex items-center gap-2 text-left"
                      >
                        区间数
                        {renderSortIcon('intervals')}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left">
                      <button
                        type="button"
                        onClick={() => handleSort('project')}
                        className="flex items-center gap-2 text-left"
                      >
                        项目
                        {renderSortIcon('project')}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left">
                      <button
                        type="button"
                        onClick={() => handleSort('updatedAt')}
                        className="flex items-center gap-2 text-left"
                      >
                        更新时间
                        {renderSortIcon('updatedAt')}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {sortedRows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-6 text-center text-slate-300">
                        暂无分项工程
                      </td>
                    </tr>
                  ) : (
                    sortedRows.map((row) => (
                      <tr key={row.phaseId} className="text-slate-100/90">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-50">{row.roadName}</div>
                          <div className="text-xs text-slate-400">{row.roadSlug}</div>
                        </td>
                        <td className="px-4 py-3">{row.phaseName}</td>
                        <td className="px-4 py-3 text-slate-300">{row.definitionName}</td>
                        <td className="px-4 py-3 text-slate-300">{row.displayLabel}</td>
                        <td className="px-4 py-3 text-slate-300">{row.intervalCount}</td>
                        <td className="px-4 py-3 text-slate-300">{row.projectLabel}</td>
                        <td className="px-4 py-3 text-slate-400">
                          {new Date(row.updatedAt).toLocaleString('zh-CN', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            href={`/progress/quantities/${row.phaseId}`}
                            className="inline-flex items-center rounded-full border border-emerald-200/60 px-4 py-1 text-xs font-semibold text-emerald-50 transition hover:border-white/80 hover:bg-white/10"
                          >
                            进入详情
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
