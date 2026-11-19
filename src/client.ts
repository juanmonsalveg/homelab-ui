// The API client every homelab app sends its HTTP through (README.md §3). It turns Authelia's
// answers to an expired session into a reload through the login page, with a guard against reload
// loops, and tells offline and unreachable apart from logged out.

/** Authelia's origin on the homelab. An app passes its own (VITE_AUTH_URL) when it has one. */
export const homelabAuthUrl = 'https://auth.lab.juanmonsalve.dev'

// Each homelab app is its own origin, so each has its own sessionStorage and its own guard.
const RELOAD_KEY = 'homelab:session-reload-at'
const RELOAD_GUARD_MS = 30_000
const REQUEST_TIMEOUT_MS = 10_000
const PROBE_TIMEOUT_MS = 5_000

/** The API answered with an error status other than 401. */
export class HttpError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'HttpError'
    this.status = status
    this.code = code
  }
}

/** True when error is the API's answer with this error code. */
export function hasCode(error: unknown, code: string): error is HttpError {
  return error instanceof HttpError && error.code === code
}

/** The Authelia session is gone. */
export class LoggedOutError extends Error {
  /**
   * True when the page is reloading into Authelia's login. False when the loop guard stopped the
   * reload, so the user has to follow loginUrl themselves.
   */
  readonly reloading: boolean
  readonly loginUrl: string

  constructor(reloading: boolean, loginUrl: string) {
    super('Session expired')
    this.name = 'LoggedOutError'
    this.reloading = reloading
    this.loginUrl = loginUrl
  }
}

/** The request never got an answer: the device is offline, or the server can't be reached. */
export class NetworkError extends Error {
  readonly reason: 'offline' | 'unreachable'

  constructor(reason: 'offline' | 'unreachable') {
    super(reason === 'offline' ? 'Offline' : 'Server unreachable')
    this.name = 'NetworkError'
    this.reason = reason
  }
}

/** The browser APIs the client uses, injectable for tests. */
export interface ClientEnv {
  fetch: (path: string, init: RequestInit) => Promise<Response>
  reload: () => void
  storage: Pick<Storage, 'getItem' | 'setItem'>
  now: () => number
  isOnline: () => boolean
  /** The app's origin, where the login page sends the user back to. */
  origin: string
  /** Authelia's origin. */
  authUrl: string
  /** How long a request may take before it counts as unreachable. 10 s unless set. */
  requestTimeoutMs?: number
}

export function createApiClient(env: ClientEnv) {
  const loginUrl = new URL(env.authUrl)
  loginUrl.searchParams.set('rd', `${env.origin}/`)

  // Allows one reload per RELOAD_GUARD_MS, so a login that bounces straight back (for example,
  // the app shell served from a cache) can't loop.
  function mayReload(): boolean {
    try {
      const now = env.now()
      const last = Number(env.storage.getItem(RELOAD_KEY) ?? 0)
      if (now - last < RELOAD_GUARD_MS) return false
      env.storage.setItem(RELOAD_KEY, String(now))
      return true
    } catch {
      // Without storage the guard can't work, so never reload automatically.
      return false
    }
  }

  function loggedOut(): LoggedOutError {
    const reloading = mayReload()
    if (reloading) env.reload()
    return new LoggedOutError(reloading, loginUrl.href)
  }

  // A failed fetch is either Authelia's login redirect blocked as a cross-origin request, or no
  // connection. /healthz is open in Authelia, so if it answers, the failure was the login.
  async function networkFailure(): Promise<Error> {
    if (!env.isOnline()) return new NetworkError('offline')
    try {
      await env.fetch('/healthz', {
        cache: 'no-store',
        credentials: 'same-origin',
        redirect: 'manual',
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      })
    } catch {
      return new NetworkError('unreachable')
    }
    return loggedOut()
  }

  // The browser sends Origin on every write, which the API's CSRF check compares against APP_URL.
  // A 204 resolves to undefined.
  async function request(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    path: string,
    { body, signal }: { body?: unknown; signal?: AbortSignal } = {},
  ): Promise<unknown> {
    const timeout = AbortSignal.timeout(
      env.requestTimeoutMs ?? REQUEST_TIMEOUT_MS,
    )
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    }
    if (body !== undefined) headers['Content-Type'] = 'application/json'
    let res: Response
    try {
      res = await env.fetch(path, {
        method,
        credentials: 'same-origin',
        redirect: 'manual',
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      })
    } catch (err) {
      if (signal?.aborted) throw err
      // Too slow is never the login: Authelia's answers come at once (a 401 or a redirect), and a
      // slow API, for example behind a database lock, can still answer /healthz, which would reload
      // the page and lose what was being typed. Away from home, requests to the LAN address
      // usually hang until this timeout, so unreachable is the right word.
      if (timeout.aborted) {
        throw new NetworkError(env.isOnline() ? 'unreachable' : 'offline')
      }
      if (err instanceof TypeError) throw await networkFailure()
      throw err
    }

    // Authelia answers an expired session with a 401 or a redirect to its login page.
    if (res.type === 'opaqueredirect' || res.status === 401) throw loggedOut()
    if (!res.ok) throw await httpError(res)
    if (res.status === 204) return undefined
    return await res.json()
  }

  return {
    get: async <T>(path: string, signal?: AbortSignal): Promise<T> =>
      (await request('GET', path, { signal })) as T,
    /** Resolves to the response body, or undefined for a 204. */
    post: async <T = void>(path: string, body?: unknown): Promise<T> =>
      (await request('POST', path, { body })) as T,
    /** For PUTs that take no body and answer 204. */
    put: async (path: string): Promise<void> => {
      await request('PUT', path)
    },
    patch: async <T>(path: string, body: unknown): Promise<T> =>
      (await request('PATCH', path, { body })) as T,
    delete: async (path: string): Promise<void> => {
      await request('DELETE', path)
    },
  }
}

export type ApiClient = ReturnType<typeof createApiClient>

/**
 * The client for the page: its fetch, reload, sessionStorage and origin. An app creates it once,
 * in its own module, passing `import.meta.env.VITE_AUTH_URL ?? homelabAuthUrl`: Vite replaces
 * `import.meta.env` only in the app's own code. fetch is looked up on each request, so tests can
 * stub it (stubApi in ./test).
 */
export function createBrowserApiClient(
  authUrl: string = homelabAuthUrl,
): ApiClient {
  return createApiClient({
    fetch: (path, init) => fetch(path, init),
    reload: () => {
      location.reload()
    },
    storage: {
      getItem: (key) => sessionStorage.getItem(key),
      setItem: (key, value) => {
        sessionStorage.setItem(key, value)
      },
    },
    now: () => Date.now(),
    isOnline: () => navigator.onLine,
    origin: location.origin,
    authUrl,
  })
}

/** Authelia's logout. It logs out of every homelab app, not just this one. */
export function logoutUrlFor(authUrl: string = homelabAuthUrl): string {
  return new URL('/logout', authUrl).href
}

async function httpError(res: Response): Promise<HttpError> {
  try {
    const body: unknown = await res.json()
    if (isErrorBody(body)) {
      return new HttpError(res.status, body.error.code, body.error.message)
    }
  } catch {
    // Not JSON, for example a proxy's error page.
  }
  return new HttpError(
    res.status,
    'http_error',
    `Request failed with status ${res.status}`,
  )
}

function isErrorBody(
  body: unknown,
): body is { error: { code: string; message: string } } {
  if (typeof body !== 'object' || body === null || !('error' in body)) {
    return false
  }
  const { error } = body
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string' &&
    'message' in error &&
    typeof error.message === 'string'
  )
}
