import { NextResponse } from 'next/server'

import { login } from '@/lib/server/authStore'
import { issueSession } from '@/lib/server/authSession'

export async function POST(request: Request) {
  let payload: { username?: string; password?: string }
  try {
    payload = (await request.json()) as { username?: string; password?: string }
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 })
  }

  if (!payload?.username || !payload.password) {
    return NextResponse.json({ message: '缺少用户名或密码' }, { status: 400 })
  }

  try {
    const user = await login(payload.username, payload.password)
    const response = NextResponse.json({ user })
    issueSession(user)
    return response
  } catch (error) {
    return NextResponse.json({ message: (error as Error).message }, { status: 401 })
  }
}
