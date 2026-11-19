import { describe, expect, it } from 'vitest'
import { HttpError, LoggedOutError, NetworkError } from './client.js'
import { createQueryClient, shouldRetry } from './queryClient.js'

describe('shouldRetry', () => {
  it('retries server errors twice', () => {
    const err = new HttpError(503, 'http_error', 'Service Unavailable')
    expect(shouldRetry(0, err)).toBe(true)
    expect(shouldRetry(1, err)).toBe(true)
    expect(shouldRetry(2, err)).toBe(false)
  })

  it.each([
    ['logged out', new LoggedOutError(true, 'https://auth.example.test/')],
    ['offline', new NetworkError('offline')],
    ['unreachable', new NetworkError('unreachable')],
    ['a client error', new HttpError(404, 'not_found', 'Not found')],
    ['an unknown error', new Error('boom')],
  ])('never retries %s', (_, err) => {
    expect(shouldRetry(0, err)).toBe(false)
  })
})

describe('createQueryClient', () => {
  it('never pauses requests while the browser says it is offline', () => {
    const defaults = createQueryClient().getDefaultOptions()
    expect(defaults.queries?.networkMode).toBe('always')
    expect(defaults.mutations?.networkMode).toBe('always')
  })

  it('never retries writes', () => {
    expect(
      createQueryClient().getDefaultOptions().mutations?.retry,
    ).toBeUndefined()
  })
})
