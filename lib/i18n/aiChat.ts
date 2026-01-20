import type { Locale } from './index'

export type AiChatCopy = {
  title: string
  description: string
  helper: string
  inputPlaceholder: string
  send: string
  clear: string
  thinking: string
  emptyState: string
  error: string
}

export const aiChatCopy: Record<Locale, AiChatCopy> = {
  zh: {
    title: 'AI 对话',
    description: '基于权限的查询助手，可调用系统工具返回项目数据。',
    helper: '可直接描述需求，例如：列出本月日报。',
    inputPlaceholder: '输入问题或指令...',
    send: '发送',
    clear: '清空对话',
    thinking: '正在思考...',
    emptyState: '尚无对话内容。',
    error: '请求失败，请稍后重试。',
  },
  fr: {
    title: 'Assistant IA',
    description: 'Assistant de requête basé sur vos permissions et les outils du système.',
    helper: 'Exemple : lister les rapports du mois.',
    inputPlaceholder: 'Saisir une question ou une instruction...',
    send: 'Envoyer',
    clear: 'Effacer',
    thinking: 'Analyse en cours...',
    emptyState: 'Aucune conversation pour le moment.',
    error: "Échec de la requête, veuillez réessayer.",
  },
}
