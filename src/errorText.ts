// Words for why a request failed, picked from the error's kind and the API's code, never its
// message (README.md §5, §7).
import { HttpError, LoggedOutError, NetworkError } from './client.js'
import { useUIStrings, type UIStrings } from './strings.js'

/** The app's words for the API error codes a screen expects, by code. */
export type ErrorCodeText = Partial<Record<string, string>>

/**
 * Why `error` happened, in the current language: the network, the session, or one of the API
 * error codes `byCode` words. Undefined when there's nothing more specific to say.
 */
export function errorReason(
  error: Error,
  t: UIStrings,
  byCode: ErrorCodeText = {},
): string | undefined {
  if (error instanceof NetworkError) {
    return error.reason === 'offline'
      ? t.network.offline
      : `${t.network.unreachable} ${t.network.homeNetworkOnly}`
  }
  if (error instanceof LoggedOutError) return t.network.sessionExpired
  if (error instanceof HttpError) return byCode[error.code]
  return undefined
}

/** errorReason in the current language, as `(error, byCode) => reason`. */
export function useErrorReason() {
  const t = useUIStrings()
  return (error: Error, byCode: ErrorCodeText = {}) =>
    errorReason(error, t, byCode)
}
