import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import type { Locale } from './i18n'
import { locales as supportedLocales } from './i18n'

const fallbackLocale: Locale = 'zh'
const STORAGE_KEY = 'dailywork:preferred-locale'

const detectLocale = (
  supported: readonly Locale[],
  fallback: Locale = fallbackLocale,
): Locale => {
  if (typeof navigator === 'undefined') return fallback

  const preferredLanguages = navigator.languages ?? [navigator.language]
  const normalized = preferredLanguages
    .filter(Boolean)
    .map((value) => value.toLowerCase())

  const matched = normalized.find((value) =>
    supported.some((locale) => value.startsWith(locale.toLowerCase())),
  )

  if (matched) {
    const normalizedMatch = supported.find((locale) => matched.startsWith(locale.toLowerCase()))
    if (normalizedMatch) return normalizedMatch
  }

  return supported.includes(fallback) ? fallback : (supported[0] as Locale)
}

type PreferredLocaleState = {
  locale: Locale
  setLocale: (next: Locale) => void
}

const LocaleContext = createContext<PreferredLocaleState | null>(null)

export const LocaleProvider = ({
  children,
  fallback = fallbackLocale,
  supported = supportedLocales,
}: {
  children: ReactNode
  fallback?: Locale
  supported?: readonly Locale[]
}) => {
  const selectSupported = (value: Locale) =>
    supported.includes(value) ? value : (supported[0] as Locale)

  const [locale, setLocale] = useState<Locale>(() => selectSupported(fallback))
  const [hasManualChoice, setHasManualChoice] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const stored = window.localStorage.getItem(STORAGE_KEY) as Locale | null
    if (stored && supported.includes(stored)) {
      setLocale(stored)
      setHasManualChoice(true)
      return
    }
    setLocale(detectLocale(supported, fallback))
  }, [fallback, supported])

  useEffect(() => {
    const updateLocale = () => {
      if (hasManualChoice) return
      setLocale(detectLocale(supported, fallback))
    }

    window.addEventListener('languagechange', updateLocale)
    return () => window.removeEventListener('languagechange', updateLocale)
  }, [fallback, supported, hasManualChoice])

  useEffect(() => {
    if (!hasManualChoice) return
    if (typeof window === 'undefined') return
    window.localStorage.setItem(STORAGE_KEY, locale)
  }, [hasManualChoice, locale])

  const setPreferredLocale = (next: Locale) => {
    setHasManualChoice(true)
    setLocale(selectSupported(next))
  }

  const value = useMemo<PreferredLocaleState>(
    () => ({
      locale,
      setLocale: setPreferredLocale,
    }),
    [locale],
  )

  return createElement(LocaleContext.Provider, { value }, children)
}

export const usePreferredLocale = (
  fallback: Locale = fallbackLocale,
  supported: readonly Locale[] = supportedLocales,
): PreferredLocaleState => {
  const context = useContext(LocaleContext)
  if (context) return context

  const selectSupported = (value: Locale) =>
    supported.includes(value) ? value : (supported[0] as Locale)

  const [locale, setLocale] = useState<Locale>(() => selectSupported(fallback))
  const [hasManualChoice, setHasManualChoice] = useState(false)

  useEffect(() => {
    const updateLocale = () => {
      if (hasManualChoice) return
      setLocale(detectLocale(supported, fallback))
    }

    window.addEventListener('languagechange', updateLocale)
    updateLocale()

    return () => window.removeEventListener('languagechange', updateLocale)
  }, [fallback, supported, hasManualChoice])

  const setPreferredLocale = (next: Locale) => {
    setHasManualChoice(true)
    setLocale(selectSupported(next))
  }

  return { locale, setLocale: setPreferredLocale }
}
