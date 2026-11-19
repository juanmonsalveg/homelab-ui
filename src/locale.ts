// The UI's language (README.md §7): English unless the person picks Spanish, a choice stored on
// each device. HomelabProvider holds it, and LanguageSwitch changes it.
import { createContext, useContext } from 'react'

export const locales = ['en', 'es'] as const
export type Locale = (typeof locales)[number]

/** Exported for tests. Each homelab app is its own origin, so each stores its own choice. */
export const localeStorageKey = 'homelab:locale'

export interface LocaleContextValue {
  locale: Locale
  /** Changes the language and stores the choice on this device. */
  setLocale: (locale: Locale) => void
}

export const LocaleContext = createContext<LocaleContextValue | null>(null)

/** The current language, and the setter that changes it. */
export function useLocale(): LocaleContextValue {
  const value = useContext(LocaleContext)
  if (!value) throw new Error('useLocale must be used inside HomelabProvider')
  return value
}

function isLocale(value: string | null): value is Locale {
  return locales.some((locale) => locale === value)
}

/** The choice stored on this device, if there is a valid one. */
export function readStoredLocale(): Locale | undefined {
  try {
    const value = localStorage.getItem(localeStorageKey)
    return isLocale(value) ? value : undefined
  } catch {
    // Storage can be blocked, for example by the browser's privacy settings.
    return undefined
  }
}

export function storeLocale(locale: Locale): void {
  try {
    localStorage.setItem(localeStorageKey, locale)
  } catch {
    // Without storage, the choice lasts until the page reloads.
  }
}
