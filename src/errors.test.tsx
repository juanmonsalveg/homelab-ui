import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { HttpError, LoggedOutError, NetworkError } from './client.js'
import { useErrorReason, type ErrorCodeText } from './errorText.js'
import { ActionError, LoadError } from './errors.js'
import { renderWithProvider } from './test.js'

const loginUrl = 'https://auth.example.test/?rd=x'

describe('LoadError', () => {
  it('says the page is reloading to log in', () => {
    renderWithProvider(
      <LoadError
        error={new LoggedOutError(true, loginUrl)}
        title="Couldn't load."
        onRetry={() => {}}
      />,
    )

    expect(screen.getByRole('status')).toHaveTextContent(
      'Taking you to the login page…',
    )
  })

  it('says the device is offline, and retries', () => {
    const onRetry = vi.fn()
    renderWithProvider(
      <LoadError
        error={new NetworkError('offline')}
        title="Couldn't load."
        onRetry={onRetry}
      />,
    )

    expect(screen.getByRole('alert')).toHaveTextContent("You're offline.")
    screen.getByRole('button', { name: 'Try again' }).click()
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('says the server is unreachable and only works at home', () => {
    renderWithProvider(
      <LoadError
        error={new NetworkError('unreachable')}
        title="Couldn't load."
        onRetry={() => {}}
      />,
    )

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent("Can't reach the server.")
    expect(alert).toHaveTextContent('It only works on the home network.')
  })

  it("shows the screen's own title for any other error", () => {
    renderWithProvider(
      <LoadError
        error={new HttpError(500, 'internal', 'boom')}
        title="Couldn't load your lists."
        onRetry={() => {}}
      />,
    )

    expect(screen.getByRole('alert')).toHaveTextContent(
      "Couldn't load your lists.",
    )
    expect(screen.getByRole('alert')).not.toHaveTextContent('boom')
  })

  it('speaks Spanish', () => {
    renderWithProvider(
      <LoadError
        error={new NetworkError('unreachable')}
        title="No se pudo cargar."
        onRetry={() => {}}
      />,
      { locale: 'es' },
    )

    expect(screen.getByRole('alert')).toHaveTextContent(
      'No se puede conectar con el servidor.',
    )
  })
})

describe('ActionError', () => {
  const byCode = { invalid_name: 'Names are 1 to 100 characters.' }

  it('shows nothing without an error', () => {
    // Its own slot: MantineProvider puts its <style> tags in the container too.
    renderWithProvider(
      <div data-testid="slot">
        <ActionError error={null} fallback="Couldn't save." />
      </div>,
    )

    expect(screen.getByTestId('slot')).toBeEmptyDOMElement()
  })

  it("words the API's error code", () => {
    renderWithProvider(
      <ActionError
        error={new HttpError(400, 'invalid_name', 'A name is 1 to 100')}
        fallback="Couldn't save."
        byCode={byCode}
      />,
    )

    expect(
      screen.getByText('Names are 1 to 100 characters.'),
    ).toBeInTheDocument()
  })

  it('falls back for a code the dialog has no words for', () => {
    renderWithProvider(
      <ActionError
        error={new HttpError(500, 'internal', 'boom')}
        fallback="Couldn't save."
        byCode={byCode}
      />,
    )

    expect(screen.getByText("Couldn't save.")).toBeInTheDocument()
  })

  it('says why when the network is to blame', () => {
    renderWithProvider(
      <ActionError
        error={new NetworkError('offline')}
        fallback="Couldn't save."
      />,
    )

    expect(screen.getByText("You're offline.")).toBeInTheDocument()
  })

  it('links to the login page when the reload guard stopped the reload', () => {
    renderWithProvider(
      <ActionError
        error={new LoggedOutError(false, loginUrl)}
        fallback="Couldn't save."
      />,
    )

    expect(screen.getByRole('link', { name: 'Log in' })).toHaveAttribute(
      'href',
      loginUrl,
    )
  })
})

describe('useErrorReason', () => {
  function Reason({ error, byCode }: { error: Error; byCode?: ErrorCodeText }) {
    const reason = useErrorReason()
    return <p>{reason(error, byCode) ?? 'nothing to say'}</p>
  }

  it.each([
    [
      new NetworkError('unreachable'),
      "Can't reach the server. It only works on the home network.",
    ],
    [
      new LoggedOutError(false, loginUrl),
      'Your session expired. Reload the page to log in.',
    ],
    [new HttpError(403, 'forbidden', 'Forbidden'), 'Only the owner can.'],
    [new HttpError(500, 'internal', 'boom'), 'nothing to say'],
    [new Error('boom'), 'nothing to say'],
  ])('words %o', (error, text) => {
    renderWithProvider(
      <Reason error={error} byCode={{ forbidden: 'Only the owner can.' }} />,
    )

    expect(screen.getByText(text)).toBeInTheDocument()
  })
})
