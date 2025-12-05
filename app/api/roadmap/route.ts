import { NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/server/authSession'

export async function GET() {
  const items = await prisma.roadmapIdea.findMany({
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ items })
}

export async function POST(request: Request) {
  const user = getSessionUser()
  if (!user) {
    return NextResponse.json({ message: '请先登录后再记录想法' }, { status: 401 })
  }

  let payload: { title?: unknown; details?: unknown }
  try {
    payload = (await request.json()) as { title?: unknown; details?: unknown }
  } catch {
    return NextResponse.json({ message: '请求体格式错误' }, { status: 400 })
  }

  const title =
    typeof payload.title === 'string' ? payload.title.trim() : ''
  const details =
    typeof payload.details === 'string' ? payload.details.trim() : ''

  if (!title) {
    return NextResponse.json({ message: '请输入想法标题' }, { status: 400 })
  }

  try {
    const item = await prisma.roadmapIdea.create({
      data: {
        title,
        details: details || null,
        createdById: user.id,
        updatedById: user.id,
      },
    })

    return NextResponse.json({ item }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ message: (error as Error).message }, { status: 500 })
  }
}
