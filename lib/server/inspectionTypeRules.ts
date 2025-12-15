import { canonicalizeProgressList } from '@/lib/i18n/progressDictionary'

const normalizeKey = (value: string) => value.trim().toLowerCase()

const allowedTypeMap: Record<string, string[]> = {
  [normalizeKey('钢筋绑扎验收')]: ['现场验收', '测量验收'],
  [normalizeKey('模板安装验收')]: ['现场验收'],
  [normalizeKey('混凝土浇筑验收')]: ['现场验收', '试验验收'],
}

export const allowedTypesForCheck = (checkName: string) => {
  if (!checkName) return null
  const canonical = canonicalizeProgressList('check', [checkName]).at(0) ?? checkName
  const forced = allowedTypeMap[normalizeKey(canonical)]
  return forced ? canonicalizeProgressList('type', forced) : null
}

export const clampTypesForCheck = (checkName: string, types: string[]) => {
  const forced = allowedTypesForCheck(checkName)
  if (forced) return forced
  return canonicalizeProgressList('type', types ?? [])
}

export const mergeTypesForCheck = (checkName: string, current: string[], incoming: string[]) => {
  const forced = allowedTypesForCheck(checkName)
  if (forced) return forced
  return canonicalizeProgressList('type', [...(current ?? []), ...(incoming ?? [])])
}

export const normalizeCheckKey = (checkName: string) => {
  const canonical = canonicalizeProgressList('check', [checkName]).at(0) ?? checkName
  return normalizeKey(canonical)
}
