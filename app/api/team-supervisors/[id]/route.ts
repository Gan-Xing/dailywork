import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'

import { formatSupervisorLabel, normalizeTeamKey } from '@/lib/members/utils'
import { hasPermission } from '@/lib/server/authSession'
import { prisma } from '@/lib/prisma'
import {
  closeActiveTeamSupervisorHistory,
  createTeamSupervisorHistory,
} from '@/lib/server/teamSupervisors'

const canManageTeamSupervisors = async () =>
  (await hasPermission('member:create')) || (await hasPermission('member:manage'))

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await canManageTeamSupervisors())) {
    return NextResponse.json({ error: '缺少成员新增权限' }, { status: 403 })
  }

  const { id } = await params
  const bindingId = Number(id)
  if (!bindingId) {
    return NextResponse.json({ error: '缺少班组绑定 ID' }, { status: 400 })
  }

  const existing = await prisma.teamSupervisor.findUnique({
    where: { id: bindingId },
  })
  if (!existing) {
    return NextResponse.json({ error: '班组绑定不存在' }, { status: 404 })
  }

  const body = await request.json().catch(() => null)
  const nextTeam = existing.team
  const teamFrInput = typeof body?.teamFr === 'string' ? body.teamFr.trim() : null
  const nextTeamFr =
    teamFrInput === null ? existing.teamFr ?? null : teamFrInput.length ? teamFrInput : null
  const teamZhInput = typeof body?.teamZh === 'string' ? body.teamZh.trim() : null
  const nextTeamZh =
    teamZhInput === null ? existing.teamZh ?? null : teamZhInput.length ? teamZhInput : null
  const projectIdInput = body?.projectId
  const parsedProjectId =
    projectIdInput === null || projectIdInput === '' || projectIdInput === undefined
      ? null
      : Number(projectIdInput)
  const teamKey = normalizeTeamKey(nextTeam)
  if (!teamKey) {
    return NextResponse.json({ error: '班组必填' }, { status: 400 })
  }

  const nextSupervisorId = Number(body?.supervisorId) || existing.supervisorId
  const supervisor = await prisma.user.findUnique({
    where: { id: nextSupervisorId },
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

  if (parsedProjectId !== null && !Number.isFinite(parsedProjectId)) {
    return NextResponse.json({ error: '项目无效' }, { status: 400 })
  }

  const project = parsedProjectId
    ? await prisma.project.findUnique({
        where: { id: parsedProjectId },
        select: { id: true, name: true, code: true, isActive: true },
      })
    : null
  if (parsedProjectId && !project) {
    return NextResponse.json({ error: '项目不存在' }, { status: 400 })
  }

  const supervisorLabel =
    formatSupervisorLabel({
      name: supervisor.name,
      frenchName: supervisor.chineseProfile?.frenchName ?? null,
      username: supervisor.username,
    }) || supervisor.username

  const historyChanged =
    (existing.teamFr ?? null) !== (nextTeamFr ?? null) ||
    (existing.teamZh ?? null) !== (nextTeamZh ?? null) ||
    existing.supervisorId !== supervisor.id ||
    (existing.projectId ?? null) !== (parsedProjectId ?? null)

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const nextBinding = await tx.teamSupervisor.update({
        where: { id: bindingId },
        data: {
          team: nextTeam,
          teamFr: nextTeamFr,
          teamZh: nextTeamZh,
          teamKey,
          supervisorId: supervisor.id,
          supervisorName: supervisorLabel,
          projectId: parsedProjectId,
        },
      })

      if (historyChanged) {
        const changedAt = nextBinding.updatedAt
        await closeActiveTeamSupervisorHistory(tx, bindingId, changedAt)
        await createTeamSupervisorHistory(
          tx,
          {
            teamSupervisorId: nextBinding.id,
            team: nextBinding.team,
            teamFr: nextBinding.teamFr,
            teamZh: nextBinding.teamZh,
            teamKey: nextBinding.teamKey,
            supervisorId: nextBinding.supervisorId,
            supervisorName: nextBinding.supervisorName,
            projectId: nextBinding.projectId,
          },
          changedAt,
        )
      }

      return nextBinding
    })
    return NextResponse.json({
      teamSupervisor: {
        id: updated.id,
        team: updated.team,
        teamFr: updated.teamFr ?? null,
        teamZh: updated.teamZh ?? null,
        teamKey: updated.teamKey,
        supervisorId: updated.supervisorId,
        supervisorLabel,
        project,
      },
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: '班组已存在' }, { status: 409 })
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '更新班组失败' },
      { status: 500 },
    )
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await canManageTeamSupervisors())) {
    return NextResponse.json({ error: '缺少成员新增权限' }, { status: 403 })
  }

  const { id } = await params
  const bindingId = Number(id)
  if (!bindingId) {
    return NextResponse.json({ error: '缺少班组绑定 ID' }, { status: 400 })
  }

  try {
    await prisma.$transaction(async (tx) => {
      await closeActiveTeamSupervisorHistory(tx, bindingId)
      await tx.teamSupervisor.delete({ where: { id: bindingId } })
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: '班组绑定不存在' }, { status: 404 })
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '删除班组失败' },
      { status: 500 },
    )
  }
}
