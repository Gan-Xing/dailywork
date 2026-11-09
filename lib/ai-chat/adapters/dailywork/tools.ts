import { Prisma, type EmploymentStatus } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { listBoqProjects } from '@/lib/server/boqStore'
import { listReports } from '@/lib/server/reportStore'
import { listRoadSections } from '@/lib/server/roadStore'

import type { ChatTool, ChatToolResult } from '../../types'
import { dailyworkApiCatalog } from './apiCatalog'
import { getAiChatRequiredPermissions, isAiChatReadableEntry } from './readPolicy'
import { buildJunctionTools } from './junctionTools'
import { buildWorkflowTools } from './workflowTools'

const clampLimit = (value: unknown, fallback: number) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.min(Math.floor(parsed), 50)
}

const buildResult = (payload: {
  ok: boolean
  content: string
  data?: unknown
  error?: string
}): ChatToolResult => ({
  ok: payload.ok,
  content: payload.content,
  data: payload.data,
  error: payload.error,
})

const resolveEmploymentStatuses = (includeOnLeave: boolean): EmploymentStatus[] => {
  return includeOnLeave ? ['ACTIVE', 'ON_LEAVE'] : ['ACTIVE']
}

const memberSelect = Prisma.validator<Prisma.UserSelect>()({
  id: true,
  name: true,
  username: true,
  position: true,
  nationality: true,
  employmentStatus: true,
  joinDate: true,
  projectAssignments: {
    where: { endDate: null },
    select: {
      project: { select: { id: true, name: true, code: true } },
      startDate: true,
    },
  },
})

type MemberRow = Prisma.UserGetPayload<{ select: typeof memberSelect }>

const assignmentSelect = Prisma.validator<Prisma.UserProjectAssignmentSelect>()({
  userId: true,
  project: { select: { id: true, name: true, code: true } },
})

type AssignmentRow = Prisma.UserProjectAssignmentGetPayload<{ select: typeof assignmentSelect }>

const filterCatalogByPermissions = (permissions: string[]) =>
  dailyworkApiCatalog.filter((entry) => {
    if (!isAiChatReadableEntry(entry)) return false
    return getAiChatRequiredPermissions(entry).some((permission) => permissions.includes(permission))
  })

const applyPathParams = (path: string, params: Record<string, unknown>) => {
  let resolved = path
  const missing: string[] = []
  const paramMatches = path.match(/:([a-zA-Z0-9_]+)\\*?/g) ?? []
  for (const match of paramMatches) {
    const key = match.replace(':', '').replace('*', '')
    const value = params[key]
    if (value === undefined || value === null || value === '') {
      missing.push(key)
      continue
    }
    const segments = Array.isArray(value) ? value : [value]
    if (segments.some((segment) => {
      const part = String(segment)
      return !part || part === '.' || part === '..' || /[/\\\u0000-\u001f\u007f]/.test(part)
    })) throw new Error('Invalid API path parameter')
    const replacement = Array.isArray(value)
      ? value.map((item) => encodeURIComponent(String(item))).join('/')
      : encodeURIComponent(String(value))
    resolved = resolved.replace(match, replacement)
  }
  return { resolved, missing }
}

const buildQueryString = (query: Record<string, unknown>) => {
  const params = new URLSearchParams()
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    if (Array.isArray(value)) {
      value.forEach((item) => params.append(key, String(item)))
      return
    }
    params.set(key, String(value))
  })
  const result = params.toString()
  return result ? `?${result}` : ''
}

const MAX_API_RESPONSE_BYTES = 512 * 1024

const readLimitedResponse = async (response: Response) => {
  const contentLength = Number(response.headers.get('content-length'))
  if (Number.isFinite(contentLength) && contentLength > MAX_API_RESPONSE_BYTES) {
    throw new Error('response_too_large')
  }
  if (!response.body) return ''
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let bytes = 0
  let content = ''
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    bytes += value.byteLength
    if (bytes > MAX_API_RESPONSE_BYTES) {
      await reader.cancel()
      throw new Error('response_too_large')
    }
    content += decoder.decode(value, { stream: true })
  }
  return content + decoder.decode()
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)

const canAccessEntry = async (
  permissions: string[],
  entryPermissions: string[],
  checker?: (permission: string) => Promise<boolean>,
) => {
  if (!entryPermissions.length) return true
  if (!checker) return entryPermissions.some((permission) => permissions.includes(permission))
  const checks = await Promise.all(entryPermissions.map((permission) => checker(permission)))
  return checks.some(Boolean)
}

const buildSystemTimePayload = () => {
  const now = new Date()
  const timezoneOffsetMinutes = -now.getTimezoneOffset()
  const utcDate = now.toISOString().slice(0, 10)
  const localDate = new Date(now.getTime() + timezoneOffsetMinutes * 60 * 1000)
    .toISOString()
    .slice(0, 10)
  return {
    iso: now.toISOString(),
    timestamp: now.getTime(),
    utcDate,
    localDate,
    timezoneOffsetMinutes,
  }
}

export const buildDailyworkTools = (): ChatTool[] => [
  ...buildJunctionTools(),
  ...buildWorkflowTools(),
  {
    name: 'get_system_time',
    description: 'Get current server time for date range calculations.',
    schema: {
      type: 'object',
      properties: {},
      required: [],
    },
    handler: async () => {
      const payload = buildSystemTimePayload()
      return buildResult({
        ok: true,
        content: `Current time is ${payload.iso}.`,
        data: payload,
      })
    },
  },
  {
    name: 'list_api_catalog',
    description: 'List available API endpoints with permissions, inputs, and response schema.',
    schema: {
      type: 'object',
      properties: {
        includeAll: { type: 'boolean', description: 'Include endpoints without permission filtering.' },
      },
      required: [],
    },
    handler: async (args, context) => {
      const includeAll = Boolean(args.includeAll)
      const permissions = context.session?.permissions ?? []
      const canViewAll = includeAll && permissions.includes('permission:view')
      const items = canViewAll
        ? dailyworkApiCatalog.filter(isAiChatReadableEntry)
        : filterCatalogByPermissions(permissions)
      return buildResult({
        ok: true,
        content: `Loaded ${items.length} API entries.`,
        data: items.map((entry) => ({
          ...entry,
          permissions: getAiChatRequiredPermissions(entry),
        })),
      })
    },
  },
  {
    name: 'call_api',
    description: 'Call a read-only API endpoint from the registry by key.',
    schema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'API catalog key, e.g. \"get:/api/roads\".' },
        params: { type: 'object', description: 'Path params for placeholders.' },
        query: { type: 'object', description: 'Query string parameters.' },
        body: { type: 'object', description: 'JSON body for non-GET requests.' },
      },
      required: ['key'],
    },
    handler: async (args, context) => {
      try {
        const key = typeof args.key === 'string' ? args.key.trim() : ''
        if (!key) {
          return buildResult({ ok: false, content: 'Missing API key.', error: 'missing_key' })
        }
        const entry = dailyworkApiCatalog.find((item) => item.key === key)
        if (!entry) {
          return buildResult({ ok: false, content: 'API entry not found.', error: 'not_found' })
        }
        if (!isAiChatReadableEntry(entry)) {
          return buildResult({
            ok: false,
            content: 'Only read-only JSON endpoints are allowed in chat mode.',
            error: 'endpoint_not_readable',
          })
        }
        const permissions = context.session?.permissions ?? []
        const checker = context.permissionChecker
        const allowed = await canAccessEntry(permissions, getAiChatRequiredPermissions(entry), checker)
        if (!allowed) {
          return buildResult({
            ok: false,
            content: 'Permission denied for this API.',
            error: 'permission_denied',
          })
        }
        const params = isRecord(args.params) ? args.params : {}
        const query = isRecord(args.query) ? args.query : {}
        const body = isRecord(args.body) ? args.body : null
        const forbiddenQueryParams = Object.keys(query).filter((name) =>
          ['debug', 'includeUrl'].includes(name),
        )
        if (forbiddenQueryParams.length) {
          return buildResult({
            ok: false,
            content: `Query params are not available in chat mode: ${forbiddenQueryParams.join(', ')}`,
            error: 'invalid_query_params',
          })
        }
        if (entry.key === 'get:/api/finance/insights') {
          const allowed = new Set(entry.queryParams.map((item) => item.name))
          const unknown = Object.keys(query).filter((name) => !allowed.has(name))
          if (unknown.length) {
            return buildResult({
              ok: false,
              content: `Unknown query params: ${unknown.join(', ')}`,
              error: 'invalid_query_params',
              data: { allowed: Array.from(allowed) },
            })
          }
        }
        const { resolved, missing } = applyPathParams(entry.path, params)
        if (missing.length) {
          return buildResult({
            ok: false,
            content: `Missing path params: ${missing.join(', ')}`,
            error: 'missing_params',
          })
        }
        const origin = context.request?.origin ?? 'http://localhost:3000'
        const url = `${origin}${resolved}${buildQueryString(query)}`
        const headers: Record<string, string> = {}
        const cookie = context.request?.getCookie ? await context.request.getCookie() : context.request?.cookie
        if (cookie) headers.cookie = cookie
        if (entry.method !== 'GET') headers['Content-Type'] = 'application/json'
        const response = await fetch(url, {
          method: entry.method,
          headers,
          body: entry.method === 'GET' ? undefined : JSON.stringify(body ?? {}),
          redirect: 'error',
          signal: context.request?.signal
            ? AbortSignal.any([context.request.signal, AbortSignal.timeout(15000)])
            : AbortSignal.timeout(15000),
        })
        const mediaType = (response.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase()
        const isJson = mediaType === 'application/json' || mediaType.endsWith('+json')
        if (!isJson) {
          return buildResult({
            ok: false,
            content: 'Only JSON API responses are available in chat mode.',
            error: 'unsupported_content_type',
          })
        }
        const raw = await readLimitedResponse(response)
        let payload: unknown
        try {
          payload = JSON.parse(raw)
        } catch {
          return buildResult({ ok: false, content: 'API returned invalid JSON.', error: 'invalid_json' })
        }
        if (!response.ok) {
          return buildResult({
            ok: false,
            content: 'API request failed.',
            error: JSON.stringify(payload),
            data: { status: response.status },
          })
        }
        if (!await canAccessEntry(permissions, getAiChatRequiredPermissions(entry), checker)) {
          return buildResult({ ok: false, content: 'Permission changed during the API request.', error: 'permission_denied' })
        }
        await context.request?.assertScope?.()
        if (entry.key === 'get:/api/finance/insights' && isRecord(payload) && isRecord(payload.insights)) {
          const insights = payload.insights as Record<string, unknown>
          const totalAmount = typeof insights.totalAmount === 'number' ? insights.totalAmount : 0
          const entryCount = typeof insights.entryCount === 'number' ? insights.entryCount : 0
          const content =
            entryCount > 0
              ? `API request succeeded. insights.totalAmount=${totalAmount}, entryCount=${entryCount}.`
              : 'API request succeeded but no matching entries were found.'
          return buildResult({
            ok: true,
            content,
            data: payload,
          })
        }
        return buildResult({
          ok: true,
          content: 'API request succeeded.',
          data: payload,
        })
      } catch (error) {
        return buildResult({
          ok: false,
          content: 'API request failed.',
          error: error instanceof Error ? error.message : String(error),
        })
      }
    },
  },
  {
    name: 'list_finance_categories',
    description: 'Read active finance categories and their keys without initializing or changing data.',
    schema: {
      type: 'object',
      properties: {
        keyword: { type: 'string', description: 'Optional category name or code to search.' },
        limit: { type: 'number', description: 'Default 20 categories, maximum 100; prefer keyword search.' },
        offset: { type: 'number', description: 'Number of categories to skip for pagination.' },
      },
      required: [],
    },
    requiredPermissions: ['finance:view'],
    handler: async (args, context) => {
      const allowed = await canAccessEntry(
        context.session?.permissions ?? [],
        ['finance:view'],
        context.permissionChecker,
      )
      if (!allowed) {
        return buildResult({ ok: false, content: 'Permission denied.', error: 'permission_denied' })
      }
      const keyword = typeof args.keyword === 'string' ? args.keyword.trim().slice(0, 100) : ''
      const parsedLimit = Number(args.limit)
      const limit = Number.isFinite(parsedLimit) && parsedLimit > 0
        ? Math.min(Math.floor(parsedLimit), 100)
        : 20
      const parsedOffset = Number(args.offset)
      const offset = Number.isSafeInteger(parsedOffset) && parsedOffset > 0
        ? Math.min(parsedOffset, 10_000)
        : 0
      try {
        const categories = await prisma.financeCategory.findMany({
          where: {
            isActive: true,
            ...(keyword
              ? {
                  OR: [
                    { key: { contains: keyword, mode: 'insensitive' } },
                    { code: { contains: keyword, mode: 'insensitive' } },
                    { labelZh: { contains: keyword, mode: 'insensitive' } },
                    { labelEn: { contains: keyword, mode: 'insensitive' } },
                    { labelFr: { contains: keyword, mode: 'insensitive' } },
                  ],
                }
              : {}),
          },
          orderBy: [{ sortOrder: 'asc' }, { key: 'asc' }],
          skip: offset,
          take: limit + 1,
          select: {
            key: true,
            parentKey: true,
            labelZh: true,
            labelEn: true,
            labelFr: true,
            code: true,
          },
        })
        return buildResult({
          ok: true,
          content: `Loaded ${Math.min(categories.length, limit)} finance categories.`,
          data: {
            categories: categories.slice(0, limit),
            hasMore: categories.length > limit,
            nextOffset: categories.length > limit ? offset + limit : null,
          },
        })
      } catch {
        return buildResult({
          ok: false,
          content: 'Failed to load finance categories.',
          error: 'category_lookup_failed',
        })
      }
    },
  },
  {
    name: 'list_road_sections',
    description: 'List road sections with slug, name, PK range, and project id.',
    schema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Maximum number of rows, up to 50.' },
      },
      required: [],
    },
    requiredPermissions: ['road:view', 'road:manage'],
    permissionMode: 'any',
    handler: async (args) => {
      try {
        const limit = clampLimit(args.limit, 20)
        const rows = await listRoadSections()
        const items = rows.slice(0, limit).map((row) => ({
          id: row.id,
          slug: row.slug,
          name: row.name,
          startPk: row.startPk,
          endPk: row.endPk,
          projectId: row.projectId,
        }))
        return buildResult({
          ok: true,
          content: `Loaded ${items.length} road sections.`,
          data: items,
        })
      } catch (error) {
        return buildResult({
          ok: false,
          content: 'Failed to load road sections.',
          error: error instanceof Error ? error.message : String(error),
        })
      }
    },
  },
  {
    name: 'list_active_members',
    description: 'List active members, optionally filtered by project.',
    schema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Maximum number of rows, up to 50.' },
        includeOnLeave: { type: 'boolean', description: 'Include on-leave members.' },
        projectId: { type: 'number', description: 'Filter by current project id.' },
      },
      required: [],
    },
    requiredPermissions: ['member:view'],
    handler: async (args) => {
      try {
        const limit = clampLimit(args.limit, 20)
        const includeOnLeave = Boolean(args.includeOnLeave)
        const projectId = Number.isFinite(Number(args.projectId)) ? Number(args.projectId) : null
        const statuses = resolveEmploymentStatuses(includeOnLeave)
        const members = (await prisma.user.findMany({
          where: {
            employmentStatus: { in: statuses },
            ...(projectId
              ? { projectAssignments: { some: { projectId, endDate: null } } }
              : {}),
          },
          orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
          take: limit,
          select: memberSelect,
        })) as MemberRow[]
        const items = members.map((member) => ({
          id: member.id,
          name: member.name,
          username: member.username,
          position: member.position,
          nationality: member.nationality,
          employmentStatus: member.employmentStatus,
          joinDate: member.joinDate?.toISOString() ?? null,
          currentProjects: member.projectAssignments.map((assignment) => ({
            id: assignment.project.id,
            name: assignment.project.name,
            code: assignment.project.code,
            startDate: assignment.startDate.toISOString(),
          })),
        }))
        return buildResult({
          ok: true,
          content: `Loaded ${items.length} members.`,
          data: items,
        })
      } catch (error) {
        return buildResult({
          ok: false,
          content: 'Failed to load members.',
          error: error instanceof Error ? error.message : String(error),
        })
      }
    },
  },
  {
    name: 'count_members_by_project',
    description: 'Count active members grouped by current project assignment.',
    schema: {
      type: 'object',
      properties: {
        includeOnLeave: { type: 'boolean', description: 'Include on-leave members.' },
      },
      required: [],
    },
    requiredPermissions: ['member:view'],
    handler: async (args) => {
      try {
        const includeOnLeave = Boolean(args.includeOnLeave)
        const statuses = resolveEmploymentStatuses(includeOnLeave)
        const assignments = (await prisma.userProjectAssignment.findMany({
          where: {
            endDate: null,
            user: { employmentStatus: { in: statuses } },
          },
          select: assignmentSelect,
        })) as AssignmentRow[]
        const map = new Map<number, { id: number; name: string; code: string | null; count: number }>()
        assignments.forEach((assignment) => {
          const current = map.get(assignment.project.id) ?? {
            id: assignment.project.id,
            name: assignment.project.name,
            code: assignment.project.code,
            count: 0,
          }
          current.count += 1
          map.set(assignment.project.id, current)
        })
        const items = Array.from(map.values()).sort((a, b) => b.count - a.count)
        return buildResult({
          ok: true,
          content: `Counted ${items.length} projects.`,
          data: items,
        })
      } catch (error) {
        return buildResult({
          ok: false,
          content: 'Failed to count members by project.',
          error: error instanceof Error ? error.message : String(error),
        })
      }
    },
  },
  {
    name: 'list_boq_projects',
    description: 'List projects available for BOQ/value views.',
    schema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Maximum number of rows, up to 50.' },
      },
      required: [],
    },
    requiredPermissions: ['value:view'],
    handler: async (args) => {
      try {
        const limit = clampLimit(args.limit, 20)
        const rows = await listBoqProjects()
        const items = rows.slice(0, limit).map((row) => ({
          id: row.id,
          name: row.name,
          code: row.code,
          isActive: row.isActive,
        }))
        return buildResult({
          ok: true,
          content: `Loaded ${items.length} projects.`,
          data: items,
        })
      } catch (error) {
        return buildResult({
          ok: false,
          content: 'Failed to load projects.',
          error: error instanceof Error ? error.message : String(error),
        })
      }
    },
  },
  {
    name: 'list_reports',
    description: 'List daily reports by month (YYYY-MM) or latest reports.',
    schema: {
      type: 'object',
      properties: {
        month: { type: 'string', description: 'Target month in YYYY-MM format.' },
        limit: { type: 'number', description: 'Maximum number of rows, up to 50.' },
      },
      required: [],
    },
    requiredPermissions: ['report:view'],
    handler: async (args) => {
      try {
        const limit = clampLimit(args.limit, 20)
        const month = typeof args.month === 'string' ? args.month.trim() : null
        const rows = await listReports({ month: month || undefined, limit })
        return buildResult({
          ok: true,
          content: `Loaded ${rows.length} reports.`,
          data: rows,
        })
      } catch (error) {
        return buildResult({
          ok: false,
          content: 'Failed to load reports.',
          error: error instanceof Error ? error.message : String(error),
        })
      }
    },
  },
]
