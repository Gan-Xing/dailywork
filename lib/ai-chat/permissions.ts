import type { ChatSession } from './types'

type JobPolicyInput = { kind: string; input: unknown }

export const requiredAiJobPermissions = (job: JobPolicyInput, artifact = false): string[] => {
  const input = job.input && typeof job.input === 'object' && !Array.isArray(job.input)
    ? job.input as Record<string, unknown> : {}
  const permissions = ['ai-chat:view', 'material:view']
  if (job.kind === 'WEEKLY_PLAN_CHANGE' && !artifact) permissions.push('material:create')
  else if (job.kind !== 'WEEKLY_PDF') return []
  if (job.kind === 'WEEKLY_PDF') {
    if (input.telegram === true) return []
    if (input.signed === true) permissions.push('signature:use')
  }
  return permissions
}

export const canAccessAiJob = (actor: ChatSession, job: JobPolicyInput, artifact = false) => {
  const required = requiredAiJobPermissions(job, artifact)
  return required.length > 0 && required.every((permission) => actor.permissions.includes(permission))
}

export const aiJobCapabilities = (actor: ChatSession, job: JobPolicyInput & {
  userId: number; status: string; expiresAt: Date | null; attempts: number; result: unknown
}) => {
  const owned = job.userId === actor.id && actor.permissions.includes('ai-chat:view')
  const authorized = owned && canAccessAiJob(actor, job)
  const result = job.result && typeof job.result === 'object' && !Array.isArray(job.result)
    ? job.result as Record<string, unknown> : {}
  return {
    confirm: authorized && job.status === 'CONFIRMATION_REQUIRED' && !!job.expiresAt && job.expiresAt.getTime() > Date.now(),
    cancel: owned && ['CONFIRMATION_REQUIRED', 'QUEUED'].includes(job.status),
    retry: authorized && job.kind === 'WEEKLY_PDF' && job.status === 'FAILED' && job.attempts < 3,
    download: owned && job.status === 'SUCCEEDED' && canAccessAiJob(actor, job, true) && typeof result.fileAssetId === 'number',
  }
}
