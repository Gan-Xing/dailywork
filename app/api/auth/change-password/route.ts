import { NextResponse } from 'next/server'

import { changePassword, getUserWithPermissions } from '@/lib/server/authStore'
import { getSessionUser, issueSession } from '@/lib/server/authSession'

export async function POST(request: Request) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    return NextResponse.json({ message: '未登录' }, { status: 401 })
  }

  let payload: { currentPassword?: string; newPassword?: string }
  try {
    payload = (await request.json()) as { currentPassword?: string; newPassword?: string }
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 })
  }

  if (!payload.currentPassword || !payload.newPassword) {
    return NextResponse.json({ message: '请提供当前密码和新密码' }, { status: 400 })
  }

  try {
    await changePassword(sessionUser.id, payload.currentPassword, payload.newPassword)
    const freshUser = await getUserWithPermissions(sessionUser.id)
    if (freshUser) {
      await issueSession(freshUser)
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ message: (error as Error).message }, { status: 400 })
  }
}
