import type { Locale } from './index'

export type AiChatCopy = {
  title: string
  description: string
  helper: string
  newChat: string
  sessionsTitle: string
  searchPlaceholder: string
  inputPlaceholder: string
  send: string
  clear: string
  thinking: string
  emptyState: string
  error: string
  toggleSidebar: string
  toggleMemory: string
  memoryTitle: string
  memoryDescription: string
  memoryScopeGlobal: string
  memoryScopeProject: string
  memoryScopeRoute: string
  memoryScopeSession: string
  memoryProjectKeyLabel: string
  memoryProjectKeyPlaceholder: string
  memoryTitleLabel: string
  memoryTitlePlaceholder: string
  memoryEdit: string
  memoryPreview: string
  memoryContentPlaceholder: string
  memoryEnabled: string
  memoryUpdatedLabel: string
  memorySave: string
  rename: string
  delete: string
  save: string
  cancel: string
  deleteConfirm: string
}

export const aiChatCopy: Record<Locale, AiChatCopy> = {
  zh: {
    title: 'AI 对话',
    description: '基于权限的查询助手，可调用系统工具返回项目数据。',
    helper: '可直接描述需求，例如：列出本月日报。',
    newChat: '新对话',
    sessionsTitle: '对话主题',
    searchPlaceholder: '搜索摘要...',
    inputPlaceholder: '输入问题或指令...',
    send: '发送',
    clear: '清空输入',
    thinking: '正在思考...',
    emptyState: '尚无对话内容。',
    error: '请求失败，请稍后重试。',
    toggleSidebar: '切换会话列表',
    toggleMemory: '打开记忆面板',
    memoryTitle: '本地记忆',
    memoryDescription: '仅保存在当前浏览器。',
    memoryScopeGlobal: '全局',
    memoryScopeProject: '项目',
    memoryScopeRoute: '页面',
    memoryScopeSession: '对话',
    memoryProjectKeyLabel: '项目标识',
    memoryProjectKeyPlaceholder: '输入项目代号或名称',
    memoryTitleLabel: '标题',
    memoryTitlePlaceholder: '例如：偏好、背景、关键规则',
    memoryEdit: '编辑',
    memoryPreview: '预览',
    memoryContentPlaceholder: '支持 Markdown，例如：\n- 关注成本问题\n- 避免推测缺失数据',
    memoryEnabled: '启用记忆',
    memoryUpdatedLabel: '上次更新',
    memorySave: '保存记忆',
    rename: '改名',
    delete: '删除',
    save: '保存',
    cancel: '取消',
    deleteConfirm: '确定要删除这个对话吗？',
  },
  fr: {
    title: 'Assistant IA',
    description: 'Assistant de requête basé sur vos permissions et les outils du système.',
    helper: 'Exemple : lister les rapports du mois.',
    newChat: 'Nouvelle discussion',
    sessionsTitle: 'Sujets',
    searchPlaceholder: 'Rechercher un résumé...',
    inputPlaceholder: 'Saisir une question ou une instruction...',
    send: 'Envoyer',
    clear: 'Effacer la saisie',
    thinking: 'Analyse en cours...',
    emptyState: 'Aucune conversation pour le moment.',
    error: "Échec de la requête, veuillez réessayer.",
    toggleSidebar: 'Basculer la liste',
    toggleMemory: 'Ouvrir la mémoire',
    memoryTitle: 'Mémoire locale',
    memoryDescription: 'Conservée uniquement dans ce navigateur.',
    memoryScopeGlobal: 'Global',
    memoryScopeProject: 'Projet',
    memoryScopeRoute: 'Page',
    memoryScopeSession: 'Session',
    memoryProjectKeyLabel: 'Clé projet',
    memoryProjectKeyPlaceholder: 'Ex: code projet ou nom',
    memoryTitleLabel: 'Titre',
    memoryTitlePlaceholder: 'Ex: préférences, contexte, règles',
    memoryEdit: 'Éditer',
    memoryPreview: 'Aperçu',
    memoryContentPlaceholder: 'Markdown supporté, ex:\n- Prioriser les coûts\n- Éviter les suppositions',
    memoryEnabled: 'Activer la mémoire',
    memoryUpdatedLabel: 'Dernière mise à jour',
    memorySave: 'Enregistrer',
    rename: 'Renommer',
    delete: 'Supprimer',
    save: 'Enregistrer',
    cancel: 'Annuler',
    deleteConfirm: 'Supprimer cette conversation ?',
  },
}
