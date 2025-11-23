import { NextResponse } from 'next/server'

import { listPermissions } from '@/lib/server/authStore'

export async function GET() {
  const permissions = await listPermissions()
  return NextResponse.json({ permissions })
}
