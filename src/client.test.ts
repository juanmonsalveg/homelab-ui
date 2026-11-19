import { describe, expect, it, vi } from 'vitest'
import {
  createApiClient,
  createBrowserApiClient,
  hasCode,
  homelabAuthUrl,
  logoutUrlFor,
  HttpError,
  LoggedOutError,
  NetworkError,
  type ApiClient,
  type ClientEnv,
} from './client.js'

const LOGIN_URL =
  'https://auth.example.test/?rd=https%3A%2F%2Ftodo.example.test%2F'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// What fetch resolves to with redirect: 'manual' when the server answers with a redirect.
const opaqueRedirect = {
  type: 'opaqueredirect',
  status: 0,
  ok: false,
} as Response

function setup(overrides: Partial<Omit<ClientEnv, 'fetch' | 'reload'>> = {}) {
  const stored = new Map<string, string>()
  let now = 1_000_000
  const env = {
    storage: {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => {
        stored.set(key, value)
      },
    },
    now: () => now,
    isOnline: () => true,
    origin: 'https://todo.example.test',
    authUrl: 'https://auth.example.test',
    ...overrides,
    fetch: vi.fn<ClientEnv['fetch']>(),
    reload: vi.fn(),
  }
  return {
    env,
    client: createApiClient(env),
    advance: (ms: number) => {
      now += ms
    },
  }
}

async function rejection(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise
  } catch (err) {
    return err
  }
  throw new Error('expected the promise to reject')
}

describe('api client', () => {
  it('returns the JSON body', async () => {
    const { env, client } = setup()
    env.fetch.mockResolvedValue(jsonResponse(200, { lists: [] }))

    await expect(client.get('/api/lists')).resolves.toEqual({ lists: [] })

    const [path, init] = env.fetch.mock.calls[0]!
    expect(path).toBe('/api/lists')
    expect(init).toMatchObject({
      credentials: 'same-origin',
      redirect: 'manual',
      headers: {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
    })
  })

  it('sends a write as JSON and returns the JSON body', async () => {
    const { env, client } = setup()
    env.fetch.mockResolvedValue(jsonResponse(201, { id: 'l1', name: 'Food' }))

    await expect(client.post('/api/lists', { name: 'Food' })).resolves.toEqual({
      id: 'l1',
      name: 'Food',
    })

    const [path, init] = env.fetch.mock.calls[0]!
    expect(path).toBe('/api/lists')
    expect(init).toMatchObject({
      method: 'POST',
      credentials: 'same-origin',
      redirect: 'manual',
      body: '{"name":"Food"}',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
    })
  })

  it('sends PATCH with its body', async () => {
    const { env, client } = setup()
    env.fetch.mockResolvedValue(jsonResponse(200, { name: 'Food' }))

    await client.patch('/api/lists/l1', { name: 'Food' })

    expect(env.fetch.mock.calls[0]![1]).toMatchObject({
      method: 'PATCH',
      body: '{"name":"Food"}',
    })
  })

  it.each([
    ['DELETE', 'DELETE', (client: ApiClient) => client.delete('/api/lists/l1')],
    [
      'PUT',
      'PUT',
      (client: ApiClient) => client.put('/api/lists/l1/members/u1'),
    ],
    [
      'a POST without a body',
      'POST',
      (client: ApiClient) => client.post('/api/x'),
    ],
  ])(
    'sends %s with no body and resolves a 204 to undefined',
    async (_, method, send) => {
      const { env, client } = setup()
      env.fetch.mockResolvedValue(new Response(null, { status: 204 }))

      await expect(send(client)).resolves.toBeUndefined()

      const init = env.fetch.mock.calls[0]![1]
      expect(init.method).toBe(method)
      expect(init.body).toBeUndefined()
      expect(init.headers).not.toHaveProperty('Content-Type')
    },
  )

  it('sends GET as GET', async () => {
    const { env, client } = setup()
    env.fetch.mockResolvedValue(jsonResponse(200, {}))

    await client.get('/api/lists')

    expect(env.fetch.mock.calls[0]![1]).toMatchObject({ method: 'GET' })
  })

  it('reloads when a write finds the session gone', async () => {
    const { env, client } = setup()
    env.fetch.mockResolvedValue(opaqueRedirect)

    const err = await rejection(client.patch('/api/lists/l1', { name: 'x' }))

    expect(err).toBeInstanceOf(LoggedOutError)
    expect(env.reload).toHaveBeenCalledOnce()
  })

  it("maps a write's error status to HttpError with the API's code", async () => {
    const { env, client } = setup()
    env.fetch.mockResolvedValue(
      jsonResponse(400, {
        error: { code: 'invalid_name', message: 'A list name is 1 to 100' },
      }),
    )

    const err = await rejection(client.post('/api/lists', { name: '' }))

    expect(err).toMatchObject({ status: 400, code: 'invalid_name' })
  })

  it.each([
    ['a 401', () => jsonResponse(401, { error: { code: 'unauthenticated' } })],
    ['a redirect to the login page', () => opaqueRedirect],
  ])('reloads on %s', async (_, response) => {
    const { env, client } = setup()
    env.fetch.mockResolvedValue(response())

    const err = await rejection(client.get('/api/lists'))

    expect(err).toBeInstanceOf(LoggedOutError)
    expect(err).toMatchObject({ reloading: true, loginUrl: LOGIN_URL })
    expect(env.reload).toHaveBeenCalledOnce()
  })

  it('stops a second reload within 30 s and offers the login link instead', async () => {
    const { env, client, advance } = setup()
    env.fetch.mockResolvedValue(opaqueRedirect)

    await rejection(client.get('/api/lists'))
    advance(29_000)
    const err = await rejection(client.get('/api/lists'))

    expect(err).toMatchObject({ reloading: false, loginUrl: LOGIN_URL })
    expect(env.reload).toHaveBeenCalledOnce()
  })

  it('reloads again once 30 s have passed', async () => {
    const { env, client, advance } = setup()
    env.fetch.mockResolvedValue(opaqueRedirect)

    await rejection(client.get('/api/lists'))
    advance(30_000)
    await rejection(client.get('/api/lists'))

    expect(env.reload).toHaveBeenCalledTimes(2)
  })

  it('never reloads when sessionStorage is unavailable', async () => {
    const { env, client } = setup({
      storage: {
        getItem: () => {
          throw new Error('SecurityError')
        },
        setItem: () => {},
      },
    })
    env.fetch.mockResolvedValue(opaqueRedirect)

    const err = await rejection(client.get('/api/lists'))

    expect(err).toMatchObject({ reloading: false })
    expect(env.reload).not.toHaveBeenCalled()
  })

  it('reports offline without probing when the browser is offline', async () => {
    const { env, client } = setup({ isOnline: () => false })
    env.fetch.mockRejectedValue(new TypeError('Failed to fetch'))

    const err = await rejection(client.get('/api/lists'))

    expect(err).toBeInstanceOf(NetworkError)
    expect(err).toMatchObject({ reason: 'offline' })
    expect(env.fetch).toHaveBeenCalledOnce()
    expect(env.reload).not.toHaveBeenCalled()
  })

  it('treats a network error as logged out when /healthz answers', async () => {
    const { env, client } = setup()
    env.fetch
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(jsonResponse(200, { status: 'ok' }))

    const err = await rejection(client.get('/api/lists'))

    expect(err).toBeInstanceOf(LoggedOutError)
    expect(env.fetch.mock.calls[1]![0]).toBe('/healthz')
    expect(env.reload).toHaveBeenCalledOnce()
  })

  it('reports unreachable when /healthz fails too', async () => {
    const { env, client } = setup()
    env.fetch.mockRejectedValue(new TypeError('Failed to fetch'))

    const err = await rejection(client.get('/api/lists'))

    expect(err).toBeInstanceOf(NetworkError)
    expect(err).toMatchObject({ reason: 'unreachable' })
    expect(env.reload).not.toHaveBeenCalled()
  })

  it('reports unreachable on a timeout without probing, so a slow API never reloads', async () => {
    const { env, client } = setup({ requestTimeoutMs: 20 })
    env.fetch.mockImplementation(
      (_, init) =>
        new Promise((_, reject) => {
          init.signal?.addEventListener('abort', () => {
            reject(init.signal?.reason)
          })
        }),
    )

    const err = await rejection(client.post('/api/lists', { name: 'Food' }))

    expect(err).toBeInstanceOf(NetworkError)
    expect(err).toMatchObject({ reason: 'unreachable' })
    expect(env.fetch).toHaveBeenCalledOnce()
    expect(env.reload).not.toHaveBeenCalled()
  })

  it('reports offline on a timeout when the browser is offline', async () => {
    const { env, client } = setup({
      requestTimeoutMs: 20,
      isOnline: () => false,
    })
    env.fetch.mockImplementation(
      (_, init) =>
        new Promise((_, reject) => {
          init.signal?.addEventListener('abort', () => {
            reject(init.signal?.reason)
          })
        }),
    )

    const err = await rejection(client.get('/api/lists'))

    expect(err).toMatchObject({ reason: 'offline' })
  })

  it('passes a cancellation through without probing', async () => {
    const { env, client } = setup()
    const controller = new AbortController()
    controller.abort()
    env.fetch.mockRejectedValue(new DOMException('Aborted', 'AbortError'))

    const err = await rejection(client.get('/api/lists', controller.signal))

    expect(err).toBeInstanceOf(DOMException)
    expect(env.fetch).toHaveBeenCalledOnce()
  })

  it("maps an error status to HttpError with the API's code", async () => {
    const { env, client } = setup()
    env.fetch.mockResolvedValue(
      jsonResponse(404, {
        error: { code: 'not_found', message: 'No such API route' },
      }),
    )

    const err = await rejection(client.get('/api/nope'))

    expect(err).toBeInstanceOf(HttpError)
    expect(err).toMatchObject({
      status: 404,
      code: 'not_found',
      message: 'No such API route',
    })
    expect(env.reload).not.toHaveBeenCalled()
  })

  it('maps a non-JSON error to a generic HttpError', async () => {
    const { env, client } = setup()
    env.fetch.mockResolvedValue(new Response('Bad Gateway', { status: 502 }))

    const err = await rejection(client.get('/api/lists'))

    expect(err).toMatchObject({ status: 502, code: 'http_error' })
  })
})

describe('hasCode', () => {
  it("matches the API's error code", () => {
    const err = new HttpError(400, 'invalid_name', 'Bad name')
    expect(hasCode(err, 'invalid_name')).toBe(true)
    expect(hasCode(err, 'not_found')).toBe(false)
  })

  it('never matches other errors', () => {
    expect(hasCode(new NetworkError('offline'), 'offline')).toBe(false)
    expect(hasCode(new Error('invalid_name'), 'invalid_name')).toBe(false)
  })
})

describe('logoutUrlFor', () => {
  it("is Authelia's /logout, the homelab's unless given another", () => {
    expect(logoutUrlFor()).toBe(new URL('/logout', homelabAuthUrl).href)
    expect(logoutUrlFor('https://auth.example.test')).toBe(
      'https://auth.example.test/logout',
    )
  })
})

describe('createBrowserApiClient', () => {
  it("uses the page's fetch, looked up on each request so tests can stub it", async () => {
    const client = createBrowserApiClient('https://auth.example.test')
    const fetch = vi.fn(async () => jsonResponse(200, { ok: true }))
    vi.stubGlobal('fetch', fetch)

    await expect(client.get('/api/x')).resolves.toEqual({ ok: true })
    expect(fetch).toHaveBeenCalledWith('/api/x', expect.anything())
  })

  it("sends the login page back to the page's own origin", async () => {
    const client = createBrowserApiClient('https://auth.example.test')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => opaqueRedirect),
    )
    // Stopped by the guard, so jsdom never tries to reload.
    sessionStorage.setItem('homelab:session-reload-at', String(Date.now()))

    const err = await rejection(client.get('/api/x'))

    expect(err).toMatchObject({ reloading: false })
    const login = new URL((err as LoggedOutError).loginUrl)
    expect(login.origin).toBe('https://auth.example.test')
    expect(login.searchParams.get('rd')).toBe(`${location.origin}/`)
  })
})
