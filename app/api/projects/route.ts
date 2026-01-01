import { NextResponse } from 'next/server'

import { hasPermission } from '@/lib/server/authSession'
import { prisma } from '@/lib/prisma'

const canViewProjects = async () =>
  (await hasPermission('member:view')) ||
  (await hasPermission('member:update')) ||
  (await hasPermission('member:edit')) ||
  (await hasPermission('member:create')) ||
  (await hasPermission('member:manage'))

export async function GET() {
  if (!(await canViewProjects())) {
    return NextResponse.json({ error: '缺少成员查看权限' }, { status: 403 })
  }

  const projects = await prisma.project.findMany({
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      name: true,
      code: true,
      isActive: true,
    },
  })

  return NextResponse.json({ projects })
}
