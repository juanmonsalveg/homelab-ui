import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HomelabProvider } from './HomelabProvider.js'
import { HttpError, LoggedOutError, NetworkError } from './client.js'
import { useErrorBar, useReportError, type BarError } from './errorBar.js'
import { errorBarMs, ErrorBarProvider } from './ErrorBarProvider.js'

function ShowButton({ error }: { error: BarError }) {
  const { show } = useErrorBar()
  return (
    <button
      type="button"
      onClick={() => {
        show(error)
      }}
    >
      {error.title}
    </button>
  )
}

function renderBar(locale: 'en' | 'es' = 'en') {
  return render(
    <HomelabProvider env="test" defaultLocale={locale}>
      <ErrorBarProvider>
        <ShowButton
          error={{ title: "Couldn't save “Milk”.", message: "You're offline." }}
        />
        <ShowButton error={{ title: "Couldn't add “Eggs”." }} />
      </ErrorBarProvider>
    </HomelabProvider>,
  )
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('the error bar', () => {
  it('shows the error and why, then goes away by itself', () => {
    renderBar()

    fireEvent.click(
      screen.getByRole('button', { name: "Couldn't save “Milk”." }),
    )
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent("Couldn't save “Milk”.")
    expect(alert).toHaveTextContent("You're offline.")

    act(() => {
      vi.advanceTimersByTime(errorBarMs - 1)
    })
    expect(screen.getByRole('alert')).toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('replaces the last error with the next, which gets its full time', () => {
    renderBar()

    fireEvent.click(
      screen.getByRole('button', { name: "Couldn't save “Milk”." }),
    )
    act(() => {
      vi.advanceTimersByTime(errorBarMs - 1000)
    })
    fireEvent.click(
      screen.getByRole('button', { name: "Couldn't add “Eggs”." }),
    )

    expect(screen.getAllByRole('alert')).toHaveLength(1)
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't add “Eggs”.")
    act(() => {
      vi.advanceTimersByTime(errorBarMs - 1)
    })
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('can be dismissed, in either language', () => {
    renderBar('es')

    fireEvent.click(
      screen.getByRole('button', { name: "Couldn't add “Eggs”." }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }))

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('useReportError', () => {
  function SaveButton({ error }: { error: Error }) {
    const report = useReportError()
    return (
      <button
        type="button"
        onClick={() => {
          report("Couldn't save “Milk”.", error, {
            invalid_title: 'Titles are 1 to 500 characters.',
          })
        }}
      >
        Save
      </button>
    )
  }

  function renderSave(error: Error) {
    render(
      <HomelabProvider env="test">
        <ErrorBarProvider>
          <SaveButton error={error} />
        </ErrorBarProvider>
      </HomelabProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  }

  it('says what failed and why', () => {
    renderSave(new NetworkError('offline'))

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent("Couldn't save “Milk”.")
    expect(alert).toHaveTextContent("You're offline.")
  })

  it("words the API's error code", () => {
    renderSave(new HttpError(400, 'invalid_title', 'A title is 1 to 500'))

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Titles are 1 to 500 characters.',
    )
  })

  it('says nothing while the page reloads to log in', () => {
    renderSave(new LoggedOutError(true, 'https://auth.example.test/'))

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('says the session expired when the reload guard stopped the reload', () => {
    renderSave(new LoggedOutError(false, 'https://auth.example.test/'))

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Your session expired. Reload the page to log in.',
    )
  })
})
