import { NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/server/authSession'

export async function GET() {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ message: '请先登录后再查看路线' }, { status: 401 })
  }
  if (!user.permissions.includes('roadmap:view')) {
    return NextResponse.json({ message: '缺少开发路线查看权限' }, { status: 403 })
  }

  const items = await prisma.roadmapIdea.findMany({
    orderBy: [
      { priority: 'desc' },
      { importance: 'desc' },
      { createdAt: 'desc' },
    ],
  })

  return NextResponse.json({ items })
}

export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ message: '请先登录后再记录想法' }, { status: 401 })
  }
  if (!user.permissions.includes('roadmap:create')) {
    return NextResponse.json({ message: '缺少开发路线编辑权限' }, { status: 403 })
  }

  let payload: {
    title?: unknown
    details?: unknown
    priority?: unknown
    importance?: unknown
    difficulty?: unknown
  }
  try {
    payload = (await request.json()) as {
      title?: unknown
      details?: unknown
      priority?: unknown
      importance?: unknown
      difficulty?: unknown
    }
  } catch {
    return NextResponse.json({ message: '请求体格式错误' }, { status: 400 })
  }

  const title =
    typeof payload.title === 'string' ? payload.title.trim() : ''
  const details =
    typeof payload.details === 'string' ? payload.details.trim() : ''
  const priority = Number(payload.priority ?? 3)
  const importance = Number(payload.importance ?? 3)
  const difficulty = Number(payload.difficulty ?? 3)

  if (!title) {
    return NextResponse.json({ message: '请输入想法标题' }, { status: 400 })
  }
  const isValidScore = (value: number) => Number.isInteger(value) && value >= 1 && value <= 5
  if (![priority, importance, difficulty].every(isValidScore)) {
    return NextResponse.json({ message: '优先级/重要度/难度需为 1-5 的整数' }, { status: 400 })
  }

  try {
    const item = await prisma.roadmapIdea.create({
      data: {
        title,
        details: details || null,
        priority,
        importance,
        difficulty,
        createdById: user.id,
        updatedById: user.id,
      },
    })

    return NextResponse.json({ item }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ message: (error as Error).message }, { status: 500 })
  }
}
