import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'

import { formatSupervisorLabel, normalizeTeamKey } from '@/lib/members/utils'
import { hasPermission } from '@/lib/server/authSession'
import { prisma } from '@/lib/prisma'

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
  const nextTeam = typeof body?.team === 'string' ? body.team.trim() : existing.team
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

  const conflict = await prisma.teamSupervisor.findUnique({
    where: { teamKey },
    select: { id: true },
  })
  if (conflict && conflict.id !== bindingId) {
    return NextResponse.json({ error: '班组已存在' }, { status: 409 })
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

  try {
    const updated = await prisma.teamSupervisor.update({
      where: { id: bindingId },
      data: {
        team: nextTeam,
        teamKey,
        supervisorId: supervisor.id,
        supervisorName: supervisorLabel,
        projectId: parsedProjectId,
      },
    })
    return NextResponse.json({
      teamSupervisor: {
        id: updated.id,
        team: updated.team,
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
    await prisma.teamSupervisor.delete({ where: { id: bindingId } })
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
