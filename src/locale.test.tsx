import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  HomelabProvider,
  type HomelabProviderProps,
} from './HomelabProvider.js'
import { LanguageSwitch } from './LanguageSwitch.js'
import { localeStorageKey } from './locale.js'
import { LoadingState } from './states.js'

function renderUI(
  ui: ReactNode = <Page />,
  props: Omit<HomelabProviderProps, 'children'> = {},
) {
  return render(
    <HomelabProvider env="test" {...props}>
      {ui}
    </HomelabProvider>,
  )
}

function Page() {
  return (
    <>
      <LanguageSwitch />
      <LoadingState />
    </>
  )
}

function expectLanguage(locale: 'en' | 'es') {
  const [name, loading] =
    locale === 'en' ? ['English', 'Loading…'] : ['Español', 'Cargando…']
  expect(screen.getByRole('radio', { name })).toBeChecked()
  expect(screen.getByRole('status')).toHaveTextContent(loading)
  expect(document.documentElement).toHaveAttribute('lang', locale)
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('the language', () => {
  it('is English by default', () => {
    renderUI()

    expectLanguage('en')
    expect(
      screen.getByRole('radiogroup', { name: 'Language' }),
    ).toBeInTheDocument()
  })

  it('switches to Spanish and back', () => {
    renderUI()

    fireEvent.click(screen.getByRole('radio', { name: 'Español' }))
    expectLanguage('es')
    expect(
      screen.getByRole('radiogroup', { name: 'Idioma' }),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('radio', { name: 'English' }))
    expectLanguage('en')
  })

  it('is stored on the device, so it survives a reload', () => {
    const { unmount } = renderUI()
    fireEvent.click(screen.getByRole('radio', { name: 'Español' }))
    expect(localStorage.getItem(localeStorageKey)).toBe('es')
    unmount()

    renderUI()

    expectLanguage('es')
  })

  it('names each language in itself, marked with its lang', () => {
    renderUI()

    expect(screen.getByText('English')).toHaveAttribute('lang', 'en')
    expect(screen.getByText('Español')).toHaveAttribute('lang', 'es')
  })

  it('starts in defaultLocale until the device has a choice', () => {
    const { unmount } = renderUI(<Page />, { defaultLocale: 'es' })
    expectLanguage('es')
    unmount()

    localStorage.setItem(localeStorageKey, 'en')
    renderUI(<Page />, { defaultLocale: 'es' })
    expectLanguage('en')
  })

  it('ignores a stored value that is not a language', () => {
    localStorage.setItem(localeStorageKey, 'fr')

    renderUI()

    expectLanguage('en')
  })

  it('falls back to English and still switches when storage is blocked', () => {
    const blocked = () => {
      throw new DOMException('Storage is blocked', 'SecurityError')
    }
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(blocked)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(blocked)

    renderUI()
    expectLanguage('en')

    fireEvent.click(screen.getByRole('radio', { name: 'Español' }))
    expectLanguage('es')
  })
})
