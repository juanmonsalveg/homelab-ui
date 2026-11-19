import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { HomelabProvider } from './HomelabProvider.js'
import { HomelabShell, type HomelabShellProps } from './HomelabShell.js'
import type { Locale } from './locale.js'

const logoutUrl = 'https://auth.example.test/logout'

function renderShell({
  user = { name: 'Ana', username: 'ana.r' },
  locale = 'en',
}: { user?: HomelabShellProps['user'] | null; locale?: Locale } = {}) {
  return render(
    <HomelabProvider env="test" defaultLocale={locale}>
      <HomelabShell
        appName="Todo"
        user={user ?? undefined}
        logoutUrl={logoutUrl}
      >
        <p>The page</p>
      </HomelabShell>
    </HomelabProvider>,
  )
}

function openAccount(name: string) {
  fireEvent.click(screen.getByRole('button', { name }))
  return screen.getByRole('dialog', { name })
}

describe('HomelabShell', () => {
  it("puts the app's name and the account menu in the header, over the page in main", () => {
    renderShell()

    const header = screen.getByRole('banner')
    expect(
      within(header).getByRole('heading', { level: 1, name: 'Todo' }),
    ).toBeInTheDocument()
    const account = within(header).getByRole('button', {
      name: "Ana's account",
    })
    expect(account).toHaveAttribute('aria-haspopup', 'dialog')
    expect(account).toHaveAttribute('aria-expanded', 'false')
    // The first letter, hidden from screen readers, which hear the button's label.
    expect(within(account).getByText('A')).toBeInTheDocument()
    expect(screen.getByRole('main')).toHaveTextContent('The page')
  })

  it('opens a panel with who I am, the language and Log out', () => {
    renderShell()

    const panel = openAccount("Ana's account")
    expect(panel).toHaveTextContent('Ana')
    expect(panel).toHaveTextContent('ana.r')
    expect(
      within(panel).getByRole('radiogroup', { name: 'Language' }),
    ).toBeInTheDocument()
    const logOut = within(panel).getByRole('link', { name: 'Log out' })
    expect(logOut).toHaveAttribute('href', logoutUrl)
    expect(logOut).toHaveAccessibleDescription(
      'Logs you out of every homelab app.',
    )
  })

  it('closes the panel with Escape', () => {
    renderShell()

    const panel = openAccount("Ana's account")
    fireEvent.keyDown(panel, { key: 'Escape' })

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: "Ana's account" }),
    ).toHaveAttribute('aria-expanded', 'false')
  })

  it("doesn't repeat a username that is the name", () => {
    renderShell({ user: { name: 'luis', username: 'luis' } })

    const panel = openAccount("luis's account")
    expect(within(panel).getAllByText('luis')).toHaveLength(1)
  })

  it('still offers the language and Log out before it knows who I am', () => {
    renderShell({ user: null })

    const panel = openAccount('Account')
    expect(
      within(panel).getByRole('radiogroup', { name: 'Language' }),
    ).toBeInTheDocument()
    expect(
      within(panel).getByRole('link', { name: 'Log out' }),
    ).toBeInTheDocument()
  })

  it('speaks Spanish', () => {
    renderShell({ locale: 'es' })

    const panel = openAccount('Cuenta de Ana')
    expect(
      within(panel).getByRole('radiogroup', { name: 'Idioma' }),
    ).toBeInTheDocument()
    expect(
      within(panel).getByRole('link', { name: 'Cerrar sesión' }),
    ).toHaveAccessibleDescription(
      'Cierra tu sesión en todas las apps del homelab.',
    )
  })
})
