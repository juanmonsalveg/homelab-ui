// The error bar: where a write that has no dialog of its own, such as an optimistic toggle, says it
// failed (README.md §5). ErrorBarProvider shows it.
import { createContext, useContext } from 'react'
import { LoggedOutError } from './client.js'
import { useErrorReason, type ErrorCodeText } from './errorText.js'

export interface BarError {
  /** What failed, such as `Couldn't save “Buy milk”.` */
  title: string
  /** Why, when there's something to say. */
  message?: string
}

export interface ErrorBarValue {
  /** Shows the error in place of any other, for a few seconds or until dismissed. */
  show: (error: BarError) => void
}

export const ErrorBarContext = createContext<ErrorBarValue | null>(null)

export function useErrorBar(): ErrorBarValue {
  const value = useContext(ErrorBarContext)
  if (!value)
    throw new Error('useErrorBar must be used inside ErrorBarProvider')
  return value
}

/**
 * Says in the error bar that `title` failed and why, with `byCode` wording the API's error codes.
 * Says nothing while the page reloads to log in.
 */
export function useReportError() {
  const reason = useErrorReason()
  const { show } = useErrorBar()
  return (title: string, error: Error, byCode: ErrorCodeText = {}) => {
    if (error instanceof LoggedOutError && error.reloading) return
    show({ title, message: reason(error, byCode) })
  }
}
