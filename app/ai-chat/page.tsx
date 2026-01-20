import { ChatClient } from './ChatClient'

import { getSessionUser } from '@/lib/server/authSession'

export default async function AiChatPage() {
  const sessionUser = await getSessionUser()

  return <ChatClient sessionUser={sessionUser ? { id: sessionUser.id, username: sessionUser.username } : null} />
}
