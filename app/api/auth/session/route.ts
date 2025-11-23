import { NextResponse } from 'next/server'

import { getSessionUser } from '@/lib/server/authSession'

export async function GET() {
  const user = getSessionUser()
  return NextResponse.json({ user: user ?? null })
}
