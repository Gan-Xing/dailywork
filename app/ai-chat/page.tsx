import { ChatClient } from './ChatClient'

import { AccessDenied } from '@/components/AccessDenied'
import { getSessionUser, hasPermission } from '@/lib/server/authSession'

export default async function AiChatPage() {
  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    return <ChatClient sessionUser={null} canDebug={false} />
  }
  const canView = await hasPermission('ai-chat:view')
  const canDebug = await hasPermission('ai-chat:debug')

  if (!canView) {
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
      canDebug={canDebug}
    />
  )
}
