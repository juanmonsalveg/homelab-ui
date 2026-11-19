import { matchesGlob } from 'node:path'
import { describe, expect, it } from 'vitest'
import { backgroundColor, homelabPwa, themeColor } from './pwa.js'

const pwaOptions = homelabPwa({
  name: 'Expenses',
  shortName: 'Spend',
  description: 'What the household spends',
})
const workbox = pwaOptions.workbox ?? {}

type Route = NonNullable<typeof workbox.runtimeCaching>[number]
type MatchOptions = Parameters<
  Extract<Route['urlPattern'], (...args: never[]) => unknown>
>[0]

const origin = 'https://app.example.test'

/** The first runtime route that matches a GET, like Workbox's router picks it. */
function routeFor(href: string, mode: Request['mode']): Route | undefined {
  const url = new URL(href)
  const options = {
    url,
    sameOrigin: url.origin === origin,
    request: { mode } as Request,
  } as MatchOptions
  return workbox.runtimeCaching?.find((route) => {
    if (typeof route.urlPattern !== 'function')
      throw new Error('expected matcher functions')
    return route.urlPattern(options)
  })
}

describe('service worker precache', () => {
  it.each(['index.html', 'offline.html', 'nested/page.html'])(
    'leaves out %s',
    (file) => {
      expect(
        workbox.globPatterns?.some((pattern) => matchesGlob(file, pattern)),
      ).toBe(false)
    },
  )

  it.each([
    'assets/index-abc123.js',
    'assets/index-abc123.css',
    'pwa-192x192.png',
    'favicon.ico',
  ])('includes %s', (file) => {
    expect(
      workbox.globPatterns?.some((pattern) => matchesGlob(file, pattern)),
    ).toBe(true)
  })

  it('has no navigation fallback', () => {
    expect(workbox.navigateFallback).toBeNull()
  })
})

describe('service worker runtime routes', () => {
  it.each([
    [`${origin}/api/things`, 'cors'],
    [`${origin}/api`, 'cors'],
    [`${origin}/healthz`, 'cors'],
    [`${origin}/api/things`, 'navigate'],
    [`${origin}/healthz`, 'navigate'],
  ] as const)('never caches %s (%s)', (href, mode) => {
    expect(routeFor(href, mode)?.handler).toBe('NetworkOnly')
  })

  it.each([`${origin}/`, `${origin}/some/spa/route`])(
    'tries the network first for navigations to %s',
    (href) => {
      const route = routeFor(href, 'navigate')
      expect(route?.handler).toBe('NetworkFirst')
      expect(route?.options?.networkTimeoutSeconds).toBe(3)
      expect(route?.options?.cacheableResponse).toEqual({ statuses: [200] })
    },
  )

  it('leaves other requests alone', () => {
    expect(routeFor(`${origin}/apiary.png`, 'no-cors')).toBeUndefined()
    expect(
      routeFor('https://auth.example.test/api/state', 'cors'),
    ).toBeUndefined()
  })
})

describe('registration and manifest', () => {
  it('fetches the manifest with credentials, so Authelia lets it through', () => {
    expect(pwaOptions.useCredentials).toBe(true)
  })

  it("registers from the app's main.tsx, never through an inline script", () => {
    expect(pwaOptions.injectRegister).toBe(false)
  })

  it('activates updates without waiting for every tab to close', () => {
    expect(pwaOptions.registerType).toBe('autoUpdate')
    expect(workbox.skipWaiting).toBe(true)
    expect(workbox.clientsClaim).toBe(true)
  })

  it("names the app and uses the theme's colours", () => {
    expect(pwaOptions.manifest).toMatchObject({
      name: 'Expenses',
      short_name: 'Spend',
      description: 'What the household spends',
      theme_color: themeColor,
      background_color: backgroundColor,
    })
  })

  it('uses the name as the short name unless given one', () => {
    const options = homelabPwa({ name: 'Todo', description: 'Todos' })
    expect(options.manifest).toMatchObject({ name: 'Todo', short_name: 'Todo' })
  })
})
