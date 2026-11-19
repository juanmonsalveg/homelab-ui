// Full-page states (README.md §6). Each one takes the place of the page's content when it can't be
// shown yet, can't be shown at all, or has nothing in it.
import {
  Button,
  Center,
  Loader,
  Stack,
  Text,
  Title,
  VisuallyHidden,
} from '@mantine/core'
import type { ReactNode } from 'react'
import { useUIStrings } from './strings.js'

const minHeight = '40vh'

/** A spinner, announced to screen readers as `label` ("Loading…" unless set). */
export function LoadingState({ label }: { label?: string }) {
  const t = useUIStrings()
  return (
    <Center role="status" mih={minHeight}>
      <Loader aria-hidden />
      <VisuallyHidden>{label ?? t.loading}</VisuallyHidden>
    </Center>
  )
}

export interface ErrorStateProps {
  title: ReactNode
  /** More detail, under the title. */
  children?: ReactNode
  /** Shows a "Try again" button that calls it. */
  onRetry?: () => void
}

export function ErrorState({ title, children, onRetry }: ErrorStateProps) {
  const t = useUIStrings()
  return (
    <PageState
      role="alert"
      title={title}
      action={onRetry && <Button onClick={onRetry}>{t.tryAgain}</Button>}
    >
      {children}
    </PageState>
  )
}

export interface EmptyStateProps {
  title: ReactNode
  /** More detail, under the title. */
  children?: ReactNode
  /** Usually a button that creates the first item. */
  action?: ReactNode
}

export function EmptyState({ title, children, action }: EmptyStateProps) {
  return (
    <PageState title={title} action={action}>
      {children}
    </PageState>
  )
}

export interface SessionExpiredStateProps {
  /** True while the page reloads into the login page, false when the reload guard stopped it. */
  reloading: boolean
  /** The login page, linked when the reload guard stopped the reload. */
  loginUrl: string
}

/** The Authelia session is gone (README.md §3). */
export function SessionExpiredState({
  reloading,
  loginUrl,
}: SessionExpiredStateProps) {
  const t = useUIStrings()
  return reloading ? (
    <PageState role="status" title={t.sessionExpired}>
      {t.reloadingToLogin}
    </PageState>
  ) : (
    <PageState
      role="alert"
      title={t.sessionExpired}
      action={
        <Button component="a" href={loginUrl}>
          {t.logIn}
        </Button>
      }
    />
  )
}

function PageState({
  role,
  title,
  children,
  action,
}: {
  role?: 'alert' | 'status'
  title: ReactNode
  children?: ReactNode
  action?: ReactNode
}) {
  return (
    <Stack
      role={role}
      align="center"
      justify="center"
      gap="sm"
      mih={minHeight}
      ta="center"
    >
      <Title order={2} size="h3">
        {title}
      </Title>
      {children !== undefined && <Text c="dimmed">{children}</Text>}
      {action}
    </Stack>
  )
}
