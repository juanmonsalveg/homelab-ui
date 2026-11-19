// Every component on one page, to look at in light and dark, at phone and desktop widths, in both
// languages (README.md §10). Nothing here talks to an API.
import '../styles.css'
import { Button, Divider, Group, Stack, Title } from '@mantine/core'
import { StrictMode, useState, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import {
  ActionError,
  EmptyState,
  ErrorBarProvider,
  ErrorState,
  HomelabProvider,
  HomelabShell,
  HttpError,
  LoadError,
  LoadingState,
  LoggedOutError,
  NetworkError,
  PersonAvatar,
  SessionExpiredState,
  logoutUrlFor,
  useReportError,
} from '../src/index.js'

const loginUrl = 'https://auth.example.test/?rd=x'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Stack gap="xs" my="lg">
      <Title order={2} size="h4">
        {title}
      </Title>
      {children}
      <Divider />
    </Stack>
  )
}

function ErrorBarButtons() {
  const report = useReportError()
  return (
    <Group>
      <Button
        variant="default"
        onClick={() => {
          report("Couldn't save “Milk”.", new NetworkError('offline'))
        }}
      >
        Offline write
      </Button>
      <Button
        variant="default"
        onClick={() => {
          report(
            "Couldn't add “Eggs”.",
            new HttpError(400, 'invalid_title', ''),
            {
              invalid_title: 'Titles are 1 to 500 characters.',
            },
          )
        }}
      >
        Invalid write
      </Button>
    </Group>
  )
}

function Playground() {
  const [signedIn, setSignedIn] = useState(true)
  return (
    <HomelabShell
      appName="Playground"
      user={signedIn ? { name: 'Ana', username: 'ana.r' } : undefined}
      logoutUrl={logoutUrlFor('https://auth.example.test')}
    >
      <Section title="Shell">
        <Button
          variant="default"
          onClick={() => {
            setSignedIn((v) => !v)
          }}
        >
          {signedIn ? 'Forget who I am' : 'Know who I am'}
        </Button>
        <Group>
          <PersonAvatar name="Ana" />
          <PersonAvatar name="luis" />
          <PersonAvatar name="Ángela" />
          <PersonAvatar />
        </Group>
      </Section>
      <Section title="Error bar">
        <ErrorBarButtons />
      </Section>
      <Section title="Failed writes">
        <ActionError
          error={new NetworkError('unreachable')}
          fallback="Couldn't save."
        />
        <ActionError
          error={new HttpError(500, 'internal', '')}
          fallback="Couldn't save."
        />
      </Section>
      <Section title="Failed loads">
        <LoadError
          error={new NetworkError('offline')}
          title="Couldn't load."
          onRetry={() => {}}
        />
        <LoadError
          error={new NetworkError('unreachable')}
          title="Couldn't load."
          onRetry={() => {}}
        />
        <LoadError
          error={new LoggedOutError(false, loginUrl)}
          title="Couldn't load."
          onRetry={() => {}}
        />
      </Section>
      <Section title="Page states">
        <LoadingState />
        <EmptyState
          title="Nothing here yet."
          action={<Button>Add the first one</Button>}
        >
          What you add shows up here.
        </EmptyState>
        <ErrorState title="Not found." />
        <SessionExpiredState reloading loginUrl={loginUrl} />
      </Section>
    </HomelabShell>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HomelabProvider>
      <ErrorBarProvider>
        <Playground />
      </ErrorBarProvider>
    </HomelabProvider>
  </StrictMode>,
)
