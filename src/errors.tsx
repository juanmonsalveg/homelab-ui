// How the client's errors show up on screen (README.md §5): a failed load takes the page's place,
// and a failed write shows in the dialog that made it. The text comes from each error's kind and
// code, never its message.
import { Alert } from '@mantine/core'
import { LoggedOutError, NetworkError } from './client.js'
import { errorReason, type ErrorCodeText } from './errorText.js'
import { ErrorState, SessionExpiredState } from './states.js'
import { useUIStrings } from './strings.js'

/** A failed load, in place of the page: `title` unless the session or the network is to blame. */
export function LoadError({
  error,
  title,
  onRetry,
}: {
  error: Error
  title: string
  onRetry: () => void
}) {
  const t = useUIStrings()
  if (error instanceof LoggedOutError) {
    return (
      <SessionExpiredState
        reloading={error.reloading}
        loginUrl={error.loginUrl}
      />
    )
  }
  if (error instanceof NetworkError) {
    return error.reason === 'offline' ? (
      <ErrorState title={t.network.offline} onRetry={onRetry} />
    ) : (
      <ErrorState title={t.network.unreachable} onRetry={onRetry}>
        {t.network.homeNetworkOnly}
      </ErrorState>
    )
  }
  return <ErrorState title={title} onRetry={onRetry} />
}

/**
 * A failed write, inside the dialog that made it. `byCode` words the API's error codes the dialog
 * expects; any other error is `fallback`, unless the session or the network is to blame.
 */
export function ActionError({
  error,
  fallback,
  byCode = {},
}: {
  error: Error | null
  fallback: string
  byCode?: ErrorCodeText
}) {
  const t = useUIStrings()
  if (!error) return null
  if (error instanceof LoggedOutError) {
    return (
      <SessionExpiredState
        reloading={error.reloading}
        loginUrl={error.loginUrl}
      />
    )
  }
  return (
    <Alert color="red" variant="light">
      {errorReason(error, t, byCode) ?? fallback}
    </Alert>
  )
}
