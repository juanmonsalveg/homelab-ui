# @juanchomogi/homelab-ui

The shared web layer of the homelab apps: React apps that run behind Traefik and Authelia on a LAN-only homelab, one origin each, installed as PWAs.

It gives every app the same look and the same behaviour where the homelab demands it. That covers the Mantine theme and app shell, an API client that survives Authelia's session expiring, how errors show up, English and Spanish, the PWA options that keep the login working, and test helpers.

Its backend counterpart is the Go module `homelab-go` (not published yet), whose handlers answer what this package asks for (`/healthz`, `/api/me`, `/api/users`, and errors as `{"error":{"code","message"}}`).

> Code comments cite this file's sections as `README.md §N`. Keep the numbers stable, and add new sections at the end.

## 1. What's in it

| Entry                                | Use it from                             | What                                                                                                                                                                                  |
| ------------------------------------ | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@juanchomogi/homelab-ui`            | App code                                | Theme and provider, app shell, page states, avatars, language and strings, API client, query client defaults, the `/api/me` and `/api/users` queries, error display and the error bar |
| `@juanchomogi/homelab-ui/styles.css` | `main.tsx`, once                        | Mantine's styles, in a cascade layer                                                                                                                                                  |
| `@juanchomogi/homelab-ui/pwa`        | `vite.config.ts`, at build time in Node | `homelabPwa()`, the vite-plugin-pwa options, and the colours                                                                                                                          |
| `@juanchomogi/homelab-ui/test`       | Vitest only                             | Stubs for what jsdom lacks, `renderWithProvider`, and a fake API behind `fetch`                                                                                                       |

The entries are separate so app code never loads the build-time or test code.

What stays in each app: its screens, its own strings, its icons and its routes. Drag to reorder will move here when a second app needs it.

## 2. Setting up an app

Install it with its peer dependencies:

```sh
npm install @juanchomogi/homelab-ui @mantine/core @mantine/hooks @tanstack/react-query react react-dom
npm install -D vite-plugin-pwa @testing-library/react vitest
```

`main.tsx`:

```tsx
import '@juanchomogi/homelab-ui/styles.css'
import { createQueryClient, HomelabProvider } from '@juanchomogi/homelab-ui'
import { QueryClientProvider } from '@tanstack/react-query'
import { registerSW } from 'virtual:pwa-register'

registerSW({ immediate: true })
const queryClient = createQueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HomelabProvider>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </HomelabProvider>
  </StrictMode>,
)
```

The app's own API module, created once:

```ts
// src/api/client.ts
import {
  createBrowserApiClient,
  createPeopleQueries,
  homelabAuthUrl,
  logoutUrlFor,
} from '@juanchomogi/homelab-ui'

const authUrl = import.meta.env.VITE_AUTH_URL ?? homelabAuthUrl
export const api = createBrowserApiClient(authUrl)
export const logoutUrl = logoutUrlFor(authUrl)
export const { meQuery, usersQuery, useMe, useUsers } = createPeopleQueries(api)
```

The app passes the auth URL in because Vite replaces `import.meta.env` only in the app's own code, never in a package.

The shell, around the app's routes:

```tsx
export default function App() {
  const t = useStrings()
  const { data: me } = useMe()
  return (
    <ErrorBarProvider>
      <HomelabShell
        appName={t.appName}
        user={me && { name: personName(me), username: me.username }}
        logoutUrl={logoutUrl}
      >
        {/* routes */}
      </HomelabShell>
    </ErrorBarProvider>
  )
}
```

`vite.config.ts`: `VitePWA(homelabPwa({ name: 'Todo', description: 'Household todo list' }))` (§8).

**What the server has to do:**

- **Content-Security-Policy.** It needs `style-src 'self' 'unsafe-inline'`, because `MantineProvider` renders `<style>` tags at runtime: the theme's CSS variables, global classes such as `hiddenFrom`, and responsive style props. Scripts stay at `'self'`. Nothing here needs an inline script: `registerSW` runs from `main.tsx`, and there's no `ColorSchemeScript` (§6). A per-request nonce was rejected, because `index.html` would stop being a static file and every app would need the same server code.
- **Authelia.** It must leave `/healthz` open (a `bypass` rule above the `*.lab` catch-all). The client probes it to tell a lost session from a lost network (§3).
- **The API.** Everything under `/api/`, errors as `{"error":{"code","message"}}`, and writes accepted only with an `Origin` equal to the app's URL. `homelab-go` does all of this.

## 3. The API client and session expiry

All of an app's HTTP goes through `createBrowserApiClient(authUrl)`, which returns `get`, `post`, `put` (no body), `patch` and `delete`. `createApiClient(env)` is the same client with the browser APIs passed in, for tests.

- **Requests.** Each one is a `fetch` with `credentials: 'same-origin'`, `redirect: 'manual'`, `Accept: application/json` and `X-Requested-With: XMLHttpRequest`. A body goes as JSON, and a `204` resolves to `undefined`. The browser sends `Origin` on every write, which the API's CSRF check compares with its URL. Each request times out after 10 s.
- **Errors** are one of three classes:
  - `HttpError`: the API answered with an error. It carries `status` and the API's `code`; `hasCode(error, 'invalid_name')` checks the code. A body that isn't the API's JSON, such as a proxy's error page, becomes the code `http_error`.
  - `LoggedOutError`: the Authelia session is gone.
  - `NetworkError`: no answer, with `reason` set to `offline` or `unreachable`.
- **Logged out.** A `401`, or `res.type === 'opaqueredirect'`, means the session is gone. Authelia may answer an expired session with either, and `redirect: 'manual'` captures the 302 to the login page instead of following it cross-origin into a CORS error. The client then calls `location.reload()`, which goes through Authelia's login page and back to the app.
  - Whatever was being typed is lost, and so is the write that got the 401.
- **A failed fetch** (a `TypeError`):
  - If `navigator.onLine` is false, the device is **offline**.
  - Otherwise the client probes `GET /healthz`, which Authelia leaves open. If it answers, the API failure was the login, so it counts as **logged out**. If it doesn't, the server is **unreachable**, which is also what happens away from home on a LAN-only app.
- **A timeout** is **unreachable**, or **offline** when `navigator.onLine` is false, with no probe. Authelia answers at once (a 401 or a redirect), so a timeout is never the login. A slow API, behind a database lock say, can still answer `/healthz`, and probing would then reload the page and lose what was being typed. Away from home, requests to the LAN address usually hang until the timeout.
- **The loop guard.** The client stores the reload time in `sessionStorage` under `homelab:session-reload-at`. If it already reloaded in the last 30 s, it doesn't reload again: `LoggedOutError.reloading` is false and its `loginUrl` (`<authUrl>/?rd=<origin>/`) is offered as a link instead. Without `sessionStorage`, the client never reloads on its own.
- `logoutUrlFor(authUrl)` is Authelia's `/logout`, which logs out of every homelab app at once. `homelabAuthUrl` is `https://auth.lab.juanmonsalve.dev`.

## 4. Server state: the query client and the people

- **`createQueryClient()`** is TanStack Query with the homelab's defaults:
  - `networkMode: 'always'` for queries and writes. The client tells offline from logged out itself, and TanStack Query would otherwise pause requests, and leave a dialog's button spinning, while `navigator.onLine` is false.
  - Queries retry only server errors (5xx), at most twice (`shouldRetry`). A logged-out error has already started a reload, and offline or unreachable errors would keep "Loading…" on screen: refetching on reconnect and the "Try again" button recover from those.
  - Writes are never retried, since a retry could repeat one that landed.
- **`createPeopleQueries(api)`** returns the queries for the people in the app, as `homelab-go` answers them:
  - `meQuery` and `useMe({ enabled })`: who I am, from `GET /api/me`, under the key `['me']` with `staleTime: Infinity`, since a different login reloads the page. Use `queryClient.fetchQuery(meQuery)` when a write needs my id whether or not the screen has it.
  - `usersQuery` and `useUsers()`: everyone who has opened the app except me, by name, from `GET /api/users` under `['users']`.
  - `Person` is `{ id, username, displayName }`. `displayName` is empty when Authelia has none, so `personName(person)` shows the username instead.

## 5. Errors

The text for an error always comes from its kind and the API's `code`, never its `message`, which stays in English for logs and `curl`.

- **`LoadError`** takes a page's place when its load fails. It shows the session-expired state, "You're offline.", or "Can't reach the server. It only works on the home network." with "Try again", and the page's own `title` for anything else.
- **`ActionError`** shows a failed write inside the dialog that made it. `byCode` words the codes the dialog expects (`{ invalid_name: '…' }`). Any other error is `fallback`, unless the network or the session is to blame.
- **`useErrorReason()`** returns `(error, byCode) => reason`: the same words as plain text, or `undefined` when there's nothing more specific to say.
- **The error bar** (`ErrorBarProvider`, `useReportError()`) is where a write with no dialog of its own says it failed, such as an optimistic toggle. It's Mantine core's `Notification` in an `Affix`, pinned to the bottom of the screen so it's seen wherever the page is scrolled. It shows one error at a time, the latest replacing the last, and goes away after 6 s or when dismissed.
  - `report(title, error, byCode)` adds the reason. It says nothing while the page reloads to the login.
  - `@mantine/notifications` (stacked, animated toasts) was the alternative, a dependency a household app doesn't need.

## 6. Theme, shell, states and avatars

Every homelab app should look the same, so they all use Mantine, styled by one theme, instead of hand-built components. Mantine was picked over MUI for its more neutral look, which is easier to make the homelab's own, and because it ships most of its styles as static CSS files.

- **`styles.css`** imports `@mantine/core/styles.layer.css`: Mantine's whole stylesheet (about 250 kB, 37 kB gzipped) inside a `mantine` cascade layer. Any unlayered app CSS overrides it, whatever order the bundle puts the files in. The provider can't import it itself: an app's Vitest loads packages from `node_modules` with Node, which can't import CSS.
- **`homelabTheme`** makes the brand blue the primary colour, with `defaultRadius: 'md'`. The blue is Tailwind's scale, with the icons' `#2563eb` at shade 6 (`brandColors`, `themeColor`). Fonts, spacing and the dark palette are Mantine's defaults. Its font stack is the system UI font, so no fonts are downloaded.
- **`HomelabProvider`** is `MantineProvider` with the theme, plus the current language (§7). The colour scheme follows the device. There's no `ColorSchemeScript`, an inline script the CSP blocks, so a dark-mode device can briefly show the light theme on load. If that flash matters, load the same logic from a small static file in `<head>`.
- **`HomelabShell`** is the page every app shares: a `<header>` with the app's name as the page's only `h1` and the account menu, over the app in `<main>`, in a `Container` of size `sm`.
  - The header scrolls away with the page. A fixed bar (Mantine's `AppShell`) would cost a phone about 56 px on every screen for things rarely needed.
  - It takes plain props: `appName` in the current language, `user` (`{ name, username }`, undefined until the app knows) and `logoutUrl`. It never fetches anything itself.
  - **The account menu** is my avatar, with my name beside it from the `xs` breakpoint up. It opens a Mantine `Popover`: a `dialog` named like the button, with the focus trapped in it and returned to the button on close. Inside are my name and username (once, when they're the same), the language switch, and Log out, a link to `logoutUrl` described as logging out of every homelab app.
  - The button's label contains the visible name ("Ana's account"), so speech input can say what it sees. Before the app knows who I am it's "Account", and the panel still has the switch and Log out.
- **The page states** are `LoadingState`, `ErrorState` (with an optional "Try again"), `EmptyState` (with an optional action) and `SessionExpiredState`. Each one takes the place of a page's content. They take plain props: `SessionExpiredState` takes `reloading` and `loginUrl`, as `LoggedOutError` carries them.
- **`PersonAvatar`** is a person's avatar, the same in every app: the first letter of their name (`initial`), in a colour Mantine picks from the name.
  - It's one letter, not Mantine's two, because in an overlapping group the next avatar covers the second. It's a whole letter even when its accent is a separate code point.
  - It passes a ref and Avatar's other props through, so a `Tooltip` can wrap it.
- **Icons.** Mantine ships none. Apps draw their few in `currentColor` and hide them from screen readers, since each control carries its own label.
- **Tests** render inside `HomelabProvider env="test"`, which turns off transitions and portals (§9).

## 7. Language

The UI is in English by default, and each person can switch it to Spanish.

- English (`en`) is the default on every device. The app doesn't follow the browser's language.
- **`LanguageSwitch`** changes it to Spanish (`es`) and back. It's a Mantine `SegmentedControl` reading "English | Español". Each language is written in itself and marked with its own `lang`, so someone who can't read the current language still finds theirs, and screen readers pronounce it right. It sits in the shell's account menu.
- **The choice** is stored in `localStorage` under `homelab:locale`, so it survives the reload after a session expires. Reads and writes are wrapped in `try`/`catch`: an unknown value or blocked storage means English, and without storage a choice lasts until the page reloads.
  - It's read before the first render, so a Spanish page never flashes English.
  - Each homelab app is its own origin, so each one stores its own choice. On iPhones, an installed app also has its own storage, separate from Safari.
- The current language keeps `<html lang>` in sync, for screen readers and spell check.
- `HomelabProvider` takes `defaultLocale` (English unless set): the language until the device has a choice, like Mantine's `defaultColorScheme`. Tests use it to render Spanish.
- `useLocale()` gives the current language and `setLocale`. `locales` lists them.
- **An app's strings** come from `createStrings({ en, es })`, which returns the app's `useStrings` hook:
  - `en.ts` is the source, and `Strings` is `typeof en`. Declare `es` as `Strings`, so a missing or extra key fails `tsc`.
  - `createStrings` needs an object for every language this package offers, so a new language here fails `tsc` in each app until it has the strings.
  - A string that needs a number or a name is a function, such as `(n: number) => string`. Plurals use `Intl.PluralRules`.
  - Dates, numbers and lists of names are formatted with `Intl` in the current language, such as `Intl.ListFormat` for "Ana and Luis" or "Ana y Luis".
- This package's own strings are in `src/strings.ts`, typed the same way.
- The Spanish speaks to the person as _tú_.
- There's no i18n library (i18next, Lingui, FormatJS). Two languages don't need extraction tools, lazy loading or language detection, and typed files already catch a missing translation at build time.
- Mantine has few built-in strings, so apps pass translated labels, `aria-label`s included, to its components.

## 8. The PWA

`homelabPwa({ name, shortName, description })` returns the vite-plugin-pwa options for every homelab app. **Read this section before changing the service worker's caching.** With Authelia in front, a service worker that answers navigations from its cache keeps reloads from ever reaching the login page, and the app reload-loops once the session expires.

- **The manifest.**
  - `id`, `start_url` and `scope` are `/`, and `display` is `standalone`. The theme and background colours come from the theme (`themeColor`, `backgroundColor`).
  - The icons are the 64, 192, 512 and 512 maskable PNGs that `@vite-pwa/assets-generator`'s `minimal-2023` preset writes into `public/`. An app's `pwa-assets.config.ts` can read `themeColor` from `/pwa` to fill the maskable and Apple icons.
  - The app's `index.html` needs the `theme-color` meta with `themeColor`, and its `apple-touch-icon`.
- **`useCredentials: true`** renders `<link rel="manifest" crossorigin="use-credentials">`. Browsers fetch the manifest without cookies by default, and behind Authelia that fetch gets the login redirect, so the app can't be installed.
- **Registration.** `injectRegister: false`, so the app calls `registerSW` from `virtual:pwa-register` in `main.tsx`. That avoids an inline script, so the CSP stays strict.
- **Updates.** `registerType: 'autoUpdate'`, with Workbox's `skipWaiting` and `clientsClaim` set explicitly, since the plugin only sets them when it injects the registration itself. The service worker looks for a new version mostly when the page loads, so the reload usually comes within seconds of opening the app, before anything is typed.
- **The caching rules:**
  - **Precache only static build assets** (`**/*.{js,css,svg,png,ico}`). **`index.html` stays out**, because Workbox's precache route maps `/` to `index.html` ahead of any runtime route.
  - `navigateFallback: null`. Navigations are **NetworkFirst** with a 3 s timeout, caching only `200` responses. Online reloads then go through Authelia, and opening the app offline still shows the last good page.
  - Same-origin `/api`, `/api/*` and `/healthz` are **NetworkOnly**, even as navigations.
  - Workbox serializes the route matchers into `sw.js`, so they can't refer to anything outside themselves.
- **Checking it.** Installing on phones only works on the real HTTPS origin. Locally, Chrome treats `http://localhost` as secure: check the manifest and service worker in DevTools → Application against a production build.

## 9. Testing an app

From `@juanchomogi/homelab-ui/test`:

- **`stubBrowserApis()`** stubs what jsdom lacks and these components use: `matchMedia` (Mantine's colour scheme, so tests get the light theme), `ResizeObserver` (the language switch) and `document.fonts` (Mantine's autosizing `Textarea`). Call it once in the app's Vitest setup file, and clear `localStorage` after each test, so each one starts in English.
- **`renderWithProvider(ui, { locale })`** renders inside `HomelabProvider env="test"`, which turns off transitions and portals, in English unless `locale` says otherwise.
- **`stubApi(handler)`** replaces `fetch` with a fake API behind the real client, so the client's own error mapping runs too. It records every request (`requests`, `writes()`), and `vi.unstubAllGlobals()` undoes it. It answers on a later task, as a network does, so React can render between a request and its answer. Answering at once hid a bug where a write's cache update unmounted the component whose `onSuccess` was still to run.
- **`apiError(status, code)`** and **`noContent()`** build the API's answers.

An app's Vitest loads this package from `node_modules` with Node, as built, so nothing in `dist/` may import CSS or rely on Vite.

## 10. Working on this package

- **Setup:** `mise install`, then `npm ci`.
- **`npm run check`** runs the typecheck, oxlint, Prettier, the tests and the build. Run it before calling a change done; CI runs it on every push and pull request.
- **`npm run dev`** opens the playground: every component on one page, on the package's own source. Look at it in light and dark, at phone and desktop widths, and in both languages.
- **The build** is plain `tsc` into `dist/`, ES modules plus type files, with Node's own module resolution, so `dist/` loads in Node as it is. That's why relative imports end in `.js`. Every app uses Vite, which handles the rest, so a bundler adds nothing yet.
- **Trying a change in an app before publishing:** run `npm pack` here, then `npm install ../homelab-ui/juanchomogi-homelab-ui-<version>.tgz` in the app's `web/`, and put the published version back afterwards. `npm link` tends to load two copies of React and Mantine, which breaks hooks and the theme.
- **Versions** are `0.x`. An app on `^0.3.0` takes `0.3.x` fixes but not `0.4.0`, so bump the minor for a breaking change and the patch otherwise.
  - Mantine's version is shared by every app. A Mantine major goes into this package first, with its peer range, then into each app.
- **Releasing:**
  1. Bump `version` in `package.json` and commit.
  2. Run `git tag v0.2.0 && git push origin v0.2.0`.
  3. The Publish workflow checks that the tag matches the version, runs `npm run check` and publishes. It uses npm trusted publishing: npmjs.com trusts this repo's `publish.yml`, so no npm token exists anywhere, and npm adds provenance itself.
  - Dependabot then opens a PR in each app.
- **The first publish.** A trusted publisher is set in the package's settings on npmjs.com, which exist only once the package does. So 0.1.0 is published by hand from the Mac (`npm login`, then `npm publish`). Then, in the package's settings on npmjs.com, add GitHub Actions as a trusted publisher: repository `juanmonsalveg/homelab-ui`, workflow `publish.yml`. Every later version goes through the workflow.
- **Code comments** cite this file's sections as `README.md §N`.
- **License:** MIT.
