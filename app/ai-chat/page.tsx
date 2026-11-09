import { ChatClient } from './ChatClient'

import { AccessDenied } from '@/components/AccessDenied'
import { getSessionUser } from '@/lib/server/authSession'
import { loadAiChatActor } from '@/lib/server/aiChatAccess'

export default async function AiChatPage() {
  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    return <ChatClient sessionUser={null} canDebug={false} />
  }
  let actor
  try { actor = await loadAiChatActor(sessionUser.id) } catch {
    return (
      <AccessDenied
        permissions={['ai-chat:view']}
        hint="需要 AI 对话权限"
      />
    )
  }

  return (
    <ChatClient
      sessionUser={{ id: sessionUser.id, username: sessionUser.username }}
      canDebug={actor.permissions.includes('ai-chat:debug')}
    />
  )
}
