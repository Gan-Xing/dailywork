import { NextResponse } from 'next/server'

import { listRoles } from '@/lib/server/authStore'

export async function GET() {
  const roles = await listRoles()
  return NextResponse.json({ roles })
}
