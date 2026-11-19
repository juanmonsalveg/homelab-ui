// TanStack Query's defaults for every homelab app (README.md §4).
import { QueryClient } from '@tanstack/react-query'
import { HttpError } from './client.js'

const MAX_RETRIES = 2

// Only server errors are worth retrying. A logged-out error has already started a reload, and
// offline or unreachable errors would just keep "Loading…" on screen: refetchOnReconnect and the
// retry button recover from those.
export function shouldRetry(failureCount: number, error: Error): boolean {
  return (
    failureCount < MAX_RETRIES &&
    error instanceof HttpError &&
    error.status >= 500
  )
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // The API client tells offline from logged out itself, so queries always run instead of
        // pausing while navigator.onLine is false.
        networkMode: 'always',
        retry: shouldRetry,
      },
      // The same for writes. Otherwise TanStack Query pauses a write while navigator.onLine is false,
      // and a dialog's button keeps spinning instead of saying the device is offline. Writes are never
      // retried (TanStack Query's default), since a retry could repeat one that landed.
      mutations: { networkMode: 'always' },
    },
  })
}
