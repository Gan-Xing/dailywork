import { NextResponse } from 'next/server'

import { clearSession } from '@/lib/server/authSession'

export async function POST() {
  clearSession()
  return NextResponse.json({ success: true })
}
