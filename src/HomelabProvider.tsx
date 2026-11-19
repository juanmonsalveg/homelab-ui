import { MantineProvider } from '@mantine/core'
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  LocaleContext,
  readStoredLocale,
  storeLocale,
  type Locale,
} from './locale.js'
import { homelabTheme } from './theme.js'

export interface HomelabProviderProps {
  children: ReactNode
  /** `test` turns off Mantine's transitions and portals, for Vitest. */
  env?: 'default' | 'test'
  /** The language until the person picks one on this device. English unless set. */
  defaultLocale?: Locale
}

/**
 * Mantine with the homelab theme, and the current language, around the whole app (README.md §6,
 * §7). The stylesheet isn't imported here: the app imports `@juanchomogi/homelab-ui/styles.css`
 * once (§2). The colour scheme follows the device. There's no ColorSchemeScript, because the CSP
 * blocks inline scripts, so a dark device can show the light theme for a moment while the page
 * loads.
 */
export function HomelabProvider({
  children,
  env,
  defaultLocale = 'en',
}: HomelabProviderProps) {
  // Read before the first render, so a Spanish page never flashes English.
  const [locale, setLocaleState] = useState<Locale>(
    () => readStoredLocale() ?? defaultLocale,
  )

  const setLocale = useCallback((next: Locale) => {
    storeLocale(next)
    setLocaleState(next)
  }, [])

  // Screen readers and spell check take the page's language from <html lang>.
  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  const localeValue = useMemo(
    () => ({ locale, setLocale }),
    [locale, setLocale],
  )

  return (
    <MantineProvider theme={homelabTheme} defaultColorScheme="auto" env={env}>
      <LocaleContext value={localeValue}>{children}</LocaleContext>
    </MantineProvider>
  )
}
