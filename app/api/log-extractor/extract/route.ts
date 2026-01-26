import { NextResponse } from 'next/server'

import { callDeepseek, DeepseekConfigError, DeepseekRequestError } from '@/lib/ai/deepseekClient'
import { prisma } from '@/lib/prisma'
import { DATE_KEY_REGEX } from '@/lib/reportUtils'
import { getSessionUser, hasPermission } from '@/lib/server/authSession'
import { getEffectiveLogExtractionPrompt, listLeaderLogPrompts } from '@/lib/server/logExtractionStore'
import {
  normalizeLogExtractionOutput,
  parseLogExtractionOutputFromText,
  type LogExtractionOutput,
} from '@/lib/logExtraction'

const canView = async () => (await hasPermission('report:view')) || (await hasPermission('report:edit'))
const canViewAll = async () =>
  (await hasPermission('leader-log:view-all')) || (await hasPermission('leader-log:edit-all'))

const buildSystemPrompt = () => `你是施工日报字段抽取助手。必须严格输出 JSON，不要输出任何解释、标题或 Markdown。
JSON 结构固定为：
{
  "observations": { "security": "", "environment": "", "general": "", "special": "" },
  "works": { "preparation": "", "earthwork": "", "pavement": "", "drainage": "", "safety": "", "geotech": "", "otherWork": "" },
  "controls": { "beTopo": "", "quarry": "", "subcontract": "", "other": "" }
}
所有值必须为中文字符串；缺失填空字符串，唯独 observations.security 为空时必须填 "RAS"。
不要新增字段，不要输出多余内容。`

const parseJsonFromText = (content: string): LogExtractionOutput | null => {
  const trimmed = content.trim()
  if (!trimmed) return null
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return null
  const snippet = trimmed.slice(start, end + 1)
  try {
    return normalizeLogExtractionOutput(JSON.parse(snippet))
  } catch {
    return null
  }
}

export async function POST(request: Request) {
  if (!(await canView())) {
    return NextResponse.json({ message: '缺少日报查看权限' }, { status: 403 })
  }

  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    return NextResponse.json({ message: '请先登录再执行抽取' }, { status: 401 })
  }

  let payload: { date?: unknown; logIds?: unknown; promptText?: unknown }
  try {
    payload = (await request.json()) as { date?: unknown; logIds?: unknown; promptText?: unknown }
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 })
  }

  const dateKey = typeof payload.date === 'string' ? payload.date.trim() : ''
  if (!DATE_KEY_REGEX.test(dateKey)) {
    return NextResponse.json({ message: 'Invalid date' }, { status: 400 })
  }

  const logIds = Array.isArray(payload.logIds)
    ? payload.logIds.map((id) => Number(id)).filter((id) => Number.isFinite(id))
    : []

  if (!logIds.length) {
    return NextResponse.json({ message: '请选择需要抽取的日志' }, { status: 400 })
  }

  const start = new Date(`${dateKey}T00:00:00.000Z`)
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 1)
  const allowAll = await canViewAll()

  const logs = await prisma.leaderDailyLog.findMany({
    where: {
      id: { in: logIds },
      logDate: { gte: start, lt: end },
      ...(allowAll ? {} : { supervisorId: sessionUser.id }),
    },
    select: {
      id: true,
      supervisorId: true,
      supervisorName: true,
      contentRaw: true,
      updatedAt: true,
    },
    orderBy: { supervisorName: 'asc' },
  })

  if (!logs.length) {
    return NextResponse.json({ message: '未找到匹配的日志内容' }, { status: 404 })
  }

  const promptText = typeof payload.promptText === 'string' && payload.promptText.trim()
    ? payload.promptText.trim()
    : await getEffectiveLogExtractionPrompt()

  const leaderPromptRecords = await listLeaderLogPrompts(
    Array.from(new Set(logs.map((log) => log.supervisorId))),
  )
  const leaderPromptMap = new Map<number, string>(
    leaderPromptRecords.map((record) => [record.supervisorId, record.promptText.trim()]),
  )

  const uniqueLeaders = Array.from(
    logs.reduce<Map<number, string>>((acc, log) => {
      if (!acc.has(log.supervisorId)) {
        acc.set(log.supervisorId, log.supervisorName)
      }
      return acc
    }, new Map()),
  ).map(([id, name]) => ({ id, name }))

  const promptByLeader = uniqueLeaders
    .map((leader) => {
      const customPrompt = leaderPromptMap.get(leader.id)
      const parts = [promptText]
      if (customPrompt) {
        parts.push(`负责人风格要求：${customPrompt}`)
      }
      return `【${leader.name}】\n${parts.join('\n')}`
    })
    .join('\n\n')

  const logContent = logs
    .map((log) => {
      const updated = log.updatedAt.toISOString().replace('T', ' ').slice(0, 16)
      const content = log.contentRaw?.trim() || '（无正文）'
      return `【${log.supervisorName}】(${updated})\n${content}`
    })
    .join('\n\n')

  const userMessage = [
    `所选日期：${dateKey}`,
    '请严格遵守以下用户提示词（按负责人拼接通用提示词与个人风格）：',
    promptByLeader,
    '',
    '原始日志如下：',
    logContent,
  ].join('\n')

  try {
    const response = await callDeepseek({
      messages: [
        { role: 'system', content: buildSystemPrompt() },
        { role: 'user', content: userMessage },
      ],
      maxTokens: 1200,
      temperature: 0.2,
    })

    const parsed = parseJsonFromText(response.content)
    const output = parsed ?? parseLogExtractionOutputFromText(response.content)

    return NextResponse.json({
      output,
      raw: response.content,
      usage: response.usage,
      logs: logs.map((log) => ({ id: log.id, supervisorName: log.supervisorName })),
    })
  } catch (error) {
    if (error instanceof DeepseekConfigError) {
      return NextResponse.json({ message: error.message }, { status: 500 })
    }
    if (error instanceof DeepseekRequestError) {
      return NextResponse.json(
        {
          message: error.message,
          status: error.status,
          payload: error.responseBody,
        },
        { status: 502 },
      )
    }
    return NextResponse.json({ message: (error as Error).message }, { status: 500 })
  }
}
