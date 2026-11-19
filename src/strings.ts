// The package's own strings, in each language (README.md §7). `es` is typed against `en`, so a key
// missing from it fails tsc. An app's strings live in the app, read through createStrings.
import { useLocale, type Locale } from './locale.js'

const en = {
  loading: 'Loading…',
  tryAgain: 'Try again',
  dismiss: 'Dismiss',
  sessionExpired: 'Your session expired.',
  reloadingToLogin: 'Taking you to the login page…',
  logIn: 'Log in',
  language: 'Language',
  account: 'Account',
  accountOf: (name: string) => `${name}'s account`,
  logOut: 'Log out',
  logOutDetail: 'Logs you out of every homelab app.',
  // Why a request failed, when the network or the session is to blame (README.md §5).
  network: {
    offline: "You're offline.",
    unreachable: "Can't reach the server.",
    homeNetworkOnly: 'It only works on the home network.',
    sessionExpired: 'Your session expired. Reload the page to log in.',
  },
}

export type UIStrings = typeof en

const es: UIStrings = {
  loading: 'Cargando…',
  tryAgain: 'Reintentar',
  dismiss: 'Cerrar',
  sessionExpired: 'Tu sesión expiró.',
  reloadingToLogin: 'Llevándote a la página de inicio de sesión…',
  logIn: 'Iniciar sesión',
  language: 'Idioma',
  account: 'Cuenta',
  accountOf: (name: string) => `Cuenta de ${name}`,
  logOut: 'Cerrar sesión',
  logOutDetail: 'Cierra tu sesión en todas las apps del homelab.',
  network: {
    offline: 'Estás sin conexión.',
    unreachable: 'No se puede conectar con el servidor.',
    homeNetworkOnly: 'Solo funciona en la red de la casa.',
    sessionExpired: 'Tu sesión expiró. Recarga la página para iniciar sesión.',
  },
}

export const uiStrings = { en, es } satisfies Record<Locale, UIStrings>

export function useUIStrings(): UIStrings {
  return uiStrings[useLocale().locale]
}
