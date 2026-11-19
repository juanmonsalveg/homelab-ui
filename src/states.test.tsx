import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { HomelabProvider } from './HomelabProvider.js'
import {
  EmptyState,
  ErrorState,
  LoadingState,
  SessionExpiredState,
} from './states.js'

function renderUI(ui: ReactNode) {
  return render(<HomelabProvider env="test">{ui}</HomelabProvider>)
}

describe('LoadingState', () => {
  it('announces that the page is loading', () => {
    renderUI(<LoadingState />)

    expect(screen.getByRole('status')).toHaveTextContent('Loading…')
  })

  it('takes another label', () => {
    renderUI(<LoadingState label="Loading your lists…" />)

    expect(screen.getByRole('status')).toHaveTextContent('Loading your lists…')
  })
})

describe('ErrorState', () => {
  it('shows the error and retries', () => {
    const onRetry = vi.fn()
    renderUI(
      <ErrorState title="Can't reach the server." onRetry={onRetry}>
        It only works on the home network.
      </ErrorState>,
    )

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent("Can't reach the server.")
    expect(alert).toHaveTextContent('It only works on the home network.')
    screen.getByRole('button', { name: 'Try again' }).click()
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('has no retry button without onRetry', () => {
    renderUI(<ErrorState title="Not found." />)

    expect(screen.getByRole('alert')).toHaveTextContent('Not found.')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})

describe('EmptyState', () => {
  it('shows the title, the detail and the action', () => {
    renderUI(
      <EmptyState
        title="No lists yet."
        action={<button type="button">New list</button>}
      >
        Lists you make or that are shared with you show up here.
      </EmptyState>,
    )

    expect(
      screen.getByRole('heading', { name: 'No lists yet.' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Lists you make or that are shared with you show up here.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'New list' })).toBeInTheDocument()
  })
})

describe('SessionExpiredState', () => {
  it('says it is reloading into the login page', () => {
    renderUI(
      <SessionExpiredState reloading loginUrl="https://auth.example.test/" />,
    )

    expect(screen.getByRole('status')).toHaveTextContent(
      'Taking you to the login page…',
    )
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('links to the login page when the reload guard stopped the reload', () => {
    const loginUrl = 'https://auth.example.test/?rd=x'
    renderUI(<SessionExpiredState reloading={false} loginUrl={loginUrl} />)

    expect(screen.getByRole('alert')).toHaveTextContent('Your session expired.')
    expect(screen.getByRole('link', { name: 'Log in' })).toHaveAttribute(
      'href',
      loginUrl,
    )
  })
})

describe('in Spanish', () => {
  function renderSpanish(ui: ReactNode) {
    return render(
      <HomelabProvider env="test" defaultLocale="es">
        {ui}
      </HomelabProvider>,
    )
  }

  it('says it is loading', () => {
    renderSpanish(<LoadingState />)

    expect(screen.getByRole('status')).toHaveTextContent('Cargando…')
  })

  it('offers to try again', () => {
    renderSpanish(<ErrorState title="Error" onRetry={() => {}} />)

    expect(
      screen.getByRole('button', { name: 'Reintentar' }),
    ).toBeInTheDocument()
  })

  it('says the session expired', () => {
    const { unmount } = renderSpanish(
      <SessionExpiredState reloading loginUrl="https://auth.example.test/" />,
    )
    expect(screen.getByRole('status')).toHaveTextContent('Tu sesión expiró.')
    expect(screen.getByRole('status')).toHaveTextContent(
      'Llevándote a la página de inicio de sesión…',
    )
    unmount()

    renderSpanish(
      <SessionExpiredState
        reloading={false}
        loginUrl="https://auth.example.test/"
      />,
    )
    expect(
      screen.getByRole('link', { name: 'Iniciar sesión' }),
    ).toBeInTheDocument()
  })
})
