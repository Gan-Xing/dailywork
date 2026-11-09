// AI exports are private task outputs, not general-purpose file-manager assets.
export const AI_CHAT_ARTIFACT_PREFIX = 'files/attachment/ai-chat/'
export const isAiChatArtifact = (storageKey: string) => {
  // Reject every dot segment: R2 URL normalization also includes the bucket path.
  if (storageKey.split('/').some((segment) => segment === '.' || segment === '..')) return true
  return storageKey.startsWith(AI_CHAT_ARTIFACT_PREFIX)
}
