import { NextResponse } from 'next/server'

import { renderBordereauTemplate } from '@/lib/documents/render'
import { loadBordereauTemplateFromFile } from '@/lib/documents/templateLoader'
import { getTemplate } from '@/lib/server/templateStore'

export async function POST(request: Request) {
  let payload: { templateId?: string; data: unknown; pageNumberText?: string }
  try {
    payload = (await request.json()) as typeof payload
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 })
  }

  const tpl = payload.templateId ? await getTemplate(payload.templateId) : null
  const fallback = tpl ?? (await loadBordereauTemplateFromFile())
  const forwardedProto = request.headers.get('x-forwarded-proto')
  const forwardedHost = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  const headerOrigin = forwardedProto && forwardedHost ? `${forwardedProto}://${forwardedHost}` : undefined
  const origin = process.env.SITE_BASE_URL || headerOrigin || new URL(request.url).origin

  const rendered = renderBordereauTemplate(fallback.html, payload.data as any, {
    pageNumberText: payload.pageNumberText ?? '',
    minItemRows: 10,
    maxItemRows: 12,
    baseUrl: origin,
  })

  return NextResponse.json({ renderedHtml: rendered })
}
