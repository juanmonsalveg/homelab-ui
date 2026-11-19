import { describe, expect, it } from 'vitest'
import { initial } from './person.js'

describe('initial', () => {
  it("is the name's first letter, upper-cased in the language", () => {
    expect(initial('Ana', 'en')).toBe('A')
    expect(initial(' ana maría ', 'en')).toBe('A')
    expect(initial('élodie', 'es')).toBe('É')
    expect(initial('', 'en')).toBe('')
  })

  it('is a whole letter, even when its accent is a separate code point', () => {
    expect(initial('A\u0301ngela', 'es')).toBe('A\u0301')
  })
})
