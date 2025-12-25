import { useEffect, useMemo, useState } from 'react'

import type { Locale } from '@/lib/i18n'

import type { MemberOption, Role } from '../types'
import { normalizeText } from '../utils'

type UseMemberEditDataParams = {
  locale: Locale
  canAssignRole: boolean
  currentTeam: string
}

export function useMemberEditData({
  locale,
  canAssignRole,
  currentTeam,
}: UseMemberEditDataParams) {
  const [rolesData, setRolesData] = useState<Role[]>([])
  const [memberOptions, setMemberOptions] = useState<MemberOption[]>([])

  const optionCollator = useMemo(() => {
    const localeId = locale === 'fr' ? 'fr' : ['zh-Hans-u-co-pinyin', 'zh-Hans', 'zh']
    return new Intl.Collator(localeId, {
      numeric: true,
      sensitivity: 'base',
    })
  }, [locale])

  const teamOptions = useMemo(() => {
    const set = new Set<string>()
    memberOptions.forEach((memberOption) => {
      const value = normalizeText(memberOption.expatProfile?.team ?? null)
      if (value) set.add(value)
    })
    const normalizedCurrentTeam = normalizeText(currentTeam)
    if (normalizedCurrentTeam) set.add(normalizedCurrentTeam)
    return Array.from(set).sort(optionCollator.compare)
  }, [currentTeam, memberOptions, optionCollator])

  const chineseSupervisorOptions = useMemo(() => {
    return memberOptions
      .filter((memberOption) => memberOption.nationality === 'china')
      .map((memberOption) => ({
        value: String(memberOption.id),
        label: normalizeText(memberOption.chineseProfile?.frenchName) || memberOption.username,
      }))
      .sort((a, b) => optionCollator.compare(a.label, b.label))
  }, [memberOptions, optionCollator])

  useEffect(() => {
    if (!canAssignRole) return
    const loadRoles = async () => {
      try {
        const res = await fetch('/api/roles')
        if (!res.ok) return
        const data = (await res.json()) as { roles?: Role[] }
        setRolesData(data.roles ?? [])
      } catch {
        setRolesData([])
      }
    }
    void loadRoles()
  }, [canAssignRole])

  useEffect(() => {
    const loadMembers = async () => {
      try {
        const res = await fetch('/api/members')
        if (!res.ok) return
        const data = (await res.json()) as { members?: MemberOption[] }
        setMemberOptions(Array.isArray(data.members) ? data.members : [])
      } catch {
        setMemberOptions([])
      }
    }
    void loadMembers()
  }, [])

  const resolvedRolesData = canAssignRole ? rolesData : []

  return { rolesData: resolvedRolesData, teamOptions, chineseSupervisorOptions }
}
