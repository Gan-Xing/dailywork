export const SIGNED_BILL_FILE_LINK_ENTITY = 'signed-bill-revision'

export type FileLinkReference = {
  entityType: string
  entityId: string
  purpose?: string | null
  label?: string | null
  meta?: unknown
}

export class ReservedFileLinkError extends Error {
  constructor() {
    super('签字账单归档关联由账单归档流程维护，不能在文件编辑中新增或修改')
  }
}

const canonical = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return Object.fromEntries(Object.keys(record).sort().map((key) => [key, canonical(record[key])]))
  }
  return value
}

const signature = (link: FileLinkReference) => JSON.stringify(canonical({
  entityType: link.entityType.trim(),
  entityId: link.entityId.trim(),
  purpose: link.purpose?.trim() || null,
  label: link.label?.trim() || null,
  meta: link.meta ?? null,
}))

/**
 * Reserved rows stay in the database, including when a normal editor sends links: [].
 * An editor may echo existing rows unchanged, but cannot create or mutate them.
 * Omitted reserved rows are preserved; only returned non-reserved rows are replaced.
 */
export function mutableFileLinkReplacements(
  requested: FileLinkReference[],
  existingReserved: FileLinkReference[],
): FileLinkReference[] {
  const remaining = existingReserved.map(signature)
  return requested.filter((link) => {
    if (link.entityType.trim() !== SIGNED_BILL_FILE_LINK_ENTITY) return true
    const match = remaining.indexOf(signature(link))
    if (match < 0) throw new ReservedFileLinkError()
    remaining.splice(match, 1)
    return false
  })
}
