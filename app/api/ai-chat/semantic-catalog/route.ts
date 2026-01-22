import { NextResponse } from 'next/server'

import { dailyworkApiCatalog } from '@/lib/ai-chat/adapters/dailywork/apiCatalog'
import { readSemanticCatalog, upsertSemanticEntry } from '@/lib/ai-chat/semanticStore'
import type { ApiSemanticEntry } from '@/lib/ai-chat/semanticTypes'
import { getSessionUser, hasPermission } from '@/lib/server/authSession'

export const dynamic = 'force-dynamic'

type SemanticUpdatePayload = {
  key?: string
  entry?: Partial<ApiSemanticEntry>
}

const normalizeKey = (value: unknown) => (typeof value === 'string' ? value.trim() : '')

export async function GET() {
  if (!(await hasPermission('permission:view'))) {
    return NextResponse.json({ message: '缺少 permission:view 权限' }, { status: 403 })
  }
  const catalog = await readSemanticCatalog()
  return NextResponse.json({ catalog: dailyworkApiCatalog, semantic: catalog })
}

export async function PUT(request: Request) {
  if (!(await hasPermission('permission:update'))) {
    return NextResponse.json({ message: '缺少 permission:update 权限' }, { status: 403 })
  }

  let payload: SemanticUpdatePayload
  try {
    payload = (await request.json()) as SemanticUpdatePayload
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 })
  }

  const key = normalizeKey(payload.key ?? payload.entry?.key)
  if (!key) {
    return NextResponse.json({ message: 'Missing key' }, { status: 400 })
  }

  const sessionUser = await getSessionUser()
  const entry = await upsertSemanticEntry(key, payload.entry ?? {}, sessionUser?.username)
  return NextResponse.json({ entry })
}
