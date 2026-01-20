'use client'

import { AccessDenied } from '@/components/AccessDenied'
import { ChatPanel } from '@/components/ai-chat/ChatPanel'
import { aiChatCopy } from '@/lib/i18n/aiChat'
import { usePreferredLocale } from '@/lib/usePreferredLocale'

type ChatClientProps = {
  sessionUser: { id: number; username: string } | null
}

export function ChatClient({ sessionUser }: ChatClientProps) {
  const { locale } = usePreferredLocale()
  const copy = aiChatCopy[locale]

  if (!sessionUser) {
    return (
      <AccessDenied
        locale={locale}
        title={locale === 'fr' ? 'Connexion requise' : '请先登录'}
        description={
          locale === 'fr'
            ? "Connectez-vous pour utiliser l'assistant IA."
            : '需要登录后才能使用 AI 对话功能。'
        }
      />
    )
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-10">
        <ChatPanel locale={locale} endpoint="/api/ai-chat/stream" labels={copy} />
      </div>
    </main>
  )
}
