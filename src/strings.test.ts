// tsc -b checks these (make lint), Vitest only runs them.
import { describe, expect, expectTypeOf, it } from 'vitest'
import { uiStrings, type UIStrings } from './strings.js'

describe("the shared UI's strings", () => {
  it('have every English key in Spanish, and no other', () => {
    expectTypeOf(uiStrings.es).toEqualTypeOf<UIStrings>()
  })

  it('fail tsc when a Spanish key is missing', () => {
    const { logIn: _, ...withoutLogIn } = uiStrings.es
    // @ts-expect-error: UIStrings needs every key the English strings have.
    const incomplete: UIStrings = withoutLogIn
    expect(incomplete).not.toHaveProperty('logIn')
  })
})
