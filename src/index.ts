// The package's main entry. ./pwa (build time) and ./test (Vitest) are separate entries, so app
// code never loads them (README.md §1).
export { backgroundColor, brandColors, themeColor } from './colors.js'
export { homelabTheme } from './theme.js'
export {
  HomelabProvider,
  type HomelabProviderProps,
} from './HomelabProvider.js'
export {
  HomelabShell,
  type HomelabShellProps,
  type ShellUser,
} from './HomelabShell.js'
export { LanguageSwitch } from './LanguageSwitch.js'
export {
  locales,
  useLocale,
  type Locale,
  type LocaleContextValue,
} from './locale.js'
export { createStrings } from './createStrings.js'
export { PersonAvatar, type PersonAvatarProps } from './PersonAvatar.js'
export {
  EmptyState,
  ErrorState,
  LoadingState,
  SessionExpiredState,
  type EmptyStateProps,
  type ErrorStateProps,
  type SessionExpiredStateProps,
} from './states.js'

export {
  createApiClient,
  createBrowserApiClient,
  hasCode,
  homelabAuthUrl,
  HttpError,
  LoggedOutError,
  logoutUrlFor,
  NetworkError,
  type ApiClient,
  type ClientEnv,
} from './client.js'
export { createQueryClient, shouldRetry } from './queryClient.js'
export { createPeopleQueries, personName, type Person } from './people.js'

export { useErrorReason, type ErrorCodeText } from './errorText.js'
export { ActionError, LoadError } from './errors.js'
export {
  useErrorBar,
  useReportError,
  type BarError,
  type ErrorBarValue,
} from './errorBar.js'
export { ErrorBarProvider, errorBarMs } from './ErrorBarProvider.js'
