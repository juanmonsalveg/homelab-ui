// tsc checks the type test (npm run typecheck), Vitest only runs it.
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createStrings } from './createStrings.js'
import { renderWithProvider } from './test.js'

const en = { greeting: 'Hello', count: (n: number) => `${n} items` }
const es: typeof en = { greeting: 'Hola', count: (n) => `${n} cosas` }

const useStrings = createStrings({ en, es })

function Greeting() {
  const t = useStrings()
  return (
    <p>
      {t.greeting}, {t.count(2)}
    </p>
  )
}

describe('createStrings', () => {
  it("reads the app's strings in the current language", () => {
    const { unmount } = renderWithProvider(<Greeting />)
    expect(screen.getByText('Hello, 2 items')).toBeInTheDocument()
    unmount()

    renderWithProvider(<Greeting />, { locale: 'es' })
    expect(screen.getByText('Hola, 2 cosas')).toBeInTheDocument()
  })

  it('fails tsc when a language has no strings', () => {
    // @ts-expect-error: every language the package offers needs strings.
    const useEnglishOnly = createStrings({ en })
    expect(typeof useEnglishOnly).toBe('function')
  })
})
