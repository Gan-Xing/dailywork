import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'

import { formatSupervisorLabel, normalizeTeamKey } from '@/lib/members/utils'
import { hasPermission } from '@/lib/server/authSession'
import { prisma } from '@/lib/prisma'

const canViewTeamSupervisors = async () =>
  (await hasPermission('member:view')) ||
  (await hasPermission('member:update')) ||
  (await hasPermission('member:edit')) ||
  (await hasPermission('member:create')) ||
  (await hasPermission('member:manage'))

const canManageTeamSupervisors = async () =>
  (await hasPermission('member:create')) || (await hasPermission('member:manage'))

export async function GET() {
  if (!(await canViewTeamSupervisors())) {
    return NextResponse.json({ error: '缺少成员查看权限' }, { status: 403 })
  }

  const bindings = await prisma.teamSupervisor.findMany({
    orderBy: { teamKey: 'asc' },
    include: {
      supervisor: {
        select: {
          id: true,
          username: true,
          name: true,
          chineseProfile: { select: { frenchName: true } },
        },
      },
    },
  })

  const teamSupervisors = bindings.map((binding) => {
    const label =
      formatSupervisorLabel({
        name: binding.supervisor.name,
        frenchName: binding.supervisor.chineseProfile?.frenchName ?? null,
        username: binding.supervisor.username,
      }) || binding.supervisorName || binding.supervisor.username
    return {
      id: binding.id,
      team: binding.team,
      teamKey: binding.teamKey,
      supervisorId: binding.supervisorId,
      supervisorLabel: label,
    }
  })

  return NextResponse.json({ teamSupervisors })
}

export async function POST(request: Request) {
  if (!(await canManageTeamSupervisors())) {
    return NextResponse.json({ error: '缺少成员新增权限' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const teamValue = typeof body?.team === 'string' ? body.team.trim() : ''
  const supervisorId = Number(body?.supervisorId)

  const teamKey = normalizeTeamKey(teamValue)
  if (!teamKey) {
    return NextResponse.json({ error: '班组必填' }, { status: 400 })
  }
  if (!supervisorId) {
    return NextResponse.json({ error: '中方负责人必填' }, { status: 400 })
  }

  const supervisor = await prisma.user.findUnique({
    where: { id: supervisorId },
    select: {
      id: true,
      username: true,
      name: true,
      nationality: true,
      chineseProfile: { select: { frenchName: true } },
    },
  })
  if (!supervisor || supervisor.nationality !== 'china') {
    return NextResponse.json({ error: '中方负责人必须为中国籍成员' }, { status: 400 })
  }

  const supervisorLabel =
    formatSupervisorLabel({
      name: supervisor.name,
      frenchName: supervisor.chineseProfile?.frenchName ?? null,
      username: supervisor.username,
    }) || supervisor.username

  try {
    const created = await prisma.teamSupervisor.create({
      data: {
        team: teamValue,
        teamKey,
        supervisorId: supervisor.id,
        supervisorName: supervisorLabel,
      },
    })
    return NextResponse.json({
      teamSupervisor: {
        id: created.id,
        team: created.team,
        teamKey: created.teamKey,
        supervisorId: created.supervisorId,
        supervisorLabel,
      },
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: '班组已存在' }, { status: 409 })
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '创建班组失败' },
      { status: 500 },
    )
  }
}
