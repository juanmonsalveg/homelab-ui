import { Affix, Container, Notification } from '@mantine/core'
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { ErrorBarContext, type BarError } from './errorBar.js'
import { useUIStrings } from './strings.js'

/** How long the bar stays up unless dismissed. Exported for tests. */
export const errorBarMs = 6_000

/**
 * Holds the error bar and shows it pinned to the bottom of the screen, so it's seen wherever the
 * page is scrolled (README.md §5). It's Mantine core's Notification in an Affix: one error at a
 * time, the latest replacing the last, which a household app doesn't need a toast package for.
 */
export function ErrorBarProvider({ children }: { children: ReactNode }) {
  const t = useUIStrings()
  // `id` changes with every error, so a new one restarts the timer even with the same words.
  const [error, setError] = useState<(BarError & { id: number }) | null>(null)

  const show = useCallback((next: BarError) => {
    setError((current) => ({ ...next, id: (current?.id ?? 0) + 1 }))
  }, [])

  useEffect(() => {
    if (!error) return
    const timer = setTimeout(() => {
      setError(null)
    }, errorBarMs)
    return () => {
      clearTimeout(timer)
    }
  }, [error])

  const value = useMemo(() => ({ show }), [show])

  return (
    <ErrorBarContext value={value}>
      {children}
      {error && (
        <Affix position={{ bottom: 16, left: 0, right: 0 }}>
          <Container size="sm">
            <Notification
              color="red"
              withBorder
              title={error.title}
              onClose={() => {
                setError(null)
              }}
              closeButtonProps={{ 'aria-label': t.dismiss }}
            >
              {error.message}
            </Notification>
          </Container>
        </Affix>
      )}
    </ErrorBarContext>
  )
}
