// Helpers for an app's Vitest tests (README.md §9). Imported from @juanchomogi/homelab-ui/test,
// never from app code.
import { render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { vi } from 'vitest'
import { HomelabProvider } from './HomelabProvider.js'
import type { Locale } from './locale.js'

/**
 * Stubs the browser APIs jsdom lacks and this package's components use. Call it once, in the
 * test setup file.
 */
export function stubBrowserApis(): void {
  // MantineProvider reads matchMedia to follow the device's colour scheme. Tests get the light theme.
  window.matchMedia = (query: string): MediaQueryList => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })

  // SegmentedControl (the language switch) uses one to place the indicator under the selected
  // option.
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  // Mantine's autosizing Textarea listens to it, to resize once fonts load.
  Object.defineProperty(document, 'fonts', {
    configurable: true,
    value: { addEventListener() {}, removeEventListener() {} },
  })
}

/**
 * Renders `ui` inside HomelabProvider with Mantine's test env (no transitions or portals), in
 * English unless `locale` says otherwise.
 */
export function renderWithProvider(
  ui: ReactNode,
  { locale = 'en' }: { locale?: Locale } = {},
) {
  return render(
    <HomelabProvider env="test" defaultLocale={locale}>
      {ui}
    </HomelabProvider>,
  )
}

export interface ApiRequest {
  method: string
  path: string
  /** The parsed JSON body, if the request had one. */
  body: unknown
}

/** Answers a request, or returns undefined for the API's 404 for an unknown route. */
export type ApiHandler = (
  req: ApiRequest,
) => Response | undefined | Promise<Response | undefined>

/**
 * A fake API behind the real client: stubs fetch with `handler` and records every request, so the
 * client's own error mapping runs too. vi.unstubAllGlobals() undoes it.
 */
export function stubApi(handler: ApiHandler) {
  const requests: ApiRequest[] = []
  const fetch = vi.fn(async (path: string, init: RequestInit = {}) => {
    const req: ApiRequest = {
      method: init.method ?? 'GET',
      path,
      body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined,
    }
    requests.push(req)
    // Answer on a later task, as a network does, so React can render between a request and its
    // answer. Answering at once hid a bug where a write's cache update unmounted the component
    // whose onSuccess was still to run.
    await new Promise((resolve) => setTimeout(resolve, 0))
    return (
      (await handler(req)) ?? apiError(404, 'not_found', 'No such API route')
    )
  })
  vi.stubGlobal('fetch', fetch)
  return {
    requests,
    /** The requests other than GETs. */
    writes: () => requests.filter((r) => r.method !== 'GET'),
  }
}

/** The API's error answer: `{"error":{"code","message"}}`. */
export function apiError(status: number, code: string, message = code) {
  return Response.json({ error: { code, message } }, { status })
}

export function noContent() {
  return new Response(null, { status: 204 })
}
