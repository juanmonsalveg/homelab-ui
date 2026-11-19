// The PWA options every homelab app builds with (README.md §8), for vite-plugin-pwa in an app's
// vite.config.ts. This entry runs in Node at build time, so it imports nothing but the colours.
// Read README.md §8 before changing the service worker's caching: with Authelia in front, a service
// worker that answers navigations from its cache keeps reloads from ever reaching the login page,
// and the app reload-loops once the session expires.
import type { VitePWAOptions } from 'vite-plugin-pwa'
import { backgroundColor, themeColor } from './colors.js'

export { backgroundColor, brandColors, themeColor } from './colors.js'

export interface HomelabPwaOptions {
  /** The installed app's name, on the splash screen and in the app switcher. */
  name: string
  /** The name under the home-screen icon. The name unless set. */
  shortName?: string
  description: string
}

export function homelabPwa({
  name,
  shortName = name,
  description,
}: HomelabPwaOptions): Partial<VitePWAOptions> {
  return {
    // Registered from the app's main.tsx through virtual:pwa-register, so no inline script weakens
    // the CSP.
    injectRegister: false,
    registerType: 'autoUpdate',
    // Browsers fetch the manifest without cookies unless told otherwise, and behind Authelia that
    // fetch gets the login redirect, so the app can't be installed.
    useCredentials: true,
    manifest: {
      id: '/',
      name,
      short_name: shortName,
      description,
      start_url: '/',
      scope: '/',
      display: 'standalone',
      theme_color: themeColor,
      background_color: backgroundColor,
      // The files @vite-pwa/assets-generator's minimal-2023 preset writes into public/.
      icons: [
        { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
        { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
        { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
        {
          src: 'maskable-icon-512x512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
        },
      ],
    },
    // The glob below already precaches the icons, and the plugin adds the manifest itself.
    includeManifestIcons: false,
    workbox: {
      // Static build assets only. index.html must stay out: Workbox maps a navigation to / onto a
      // precached index.html ahead of any runtime route.
      globPatterns: ['**/*.{js,css,svg,png,ico}'],
      navigateFallback: null,
      // autoUpdate needs these, and the plugin only sets them when it injects the registration
      // itself. Without them a new service worker waits until every tab is closed.
      skipWaiting: true,
      clientsClaim: true,
      // Workbox serializes these matchers into sw.js, so they can't refer to anything outside
      // themselves.
      runtimeCaching: [
        {
          urlPattern: ({ sameOrigin, url }) =>
            sameOrigin &&
            (url.pathname === '/healthz' ||
              url.pathname === '/api' ||
              url.pathname.startsWith('/api/')),
          handler: 'NetworkOnly',
        },
        {
          // Online reloads go through Authelia; offline, the last good page still opens. Only 200s
          // are cached, never Authelia's redirect to the login page.
          urlPattern: ({ request }) => request.mode === 'navigate',
          handler: 'NetworkFirst',
          options: {
            cacheName: 'pages',
            networkTimeoutSeconds: 3,
            cacheableResponse: { statuses: [200] },
          },
        },
      ],
    },
  }
}
