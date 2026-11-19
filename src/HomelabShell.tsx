import {
  Box,
  Button,
  Container,
  Group,
  Popover,
  Stack,
  Text,
  Title,
  UnstyledButton,
} from '@mantine/core'
import { useId, type ReactNode } from 'react'
import { LanguageSwitch } from './LanguageSwitch.js'
import { PersonAvatar } from './PersonAvatar.js'
import { useUIStrings } from './strings.js'

/** Who's logged in, as Authelia says (README.md §6). */
export interface ShellUser {
  /** The display name, or the username without one (personName). */
  name: string
  username: string
}

export interface HomelabShellProps {
  /** The app's name in the current language: the page's only h1. */
  appName: string
  /** Undefined until the app knows, or if it can't find out. */
  user?: ShellUser
  /** Authelia's logout page (logoutUrlFor), which logs out of every homelab app. */
  logoutUrl: string
  children: ReactNode
}

/**
 * The page every homelab app shares (README.md §6): a header with the app's name and the account
 * menu, over the app's `children` in <main>. The header scrolls away with the page.
 */
export function HomelabShell({
  appName,
  user,
  logoutUrl,
  children,
}: HomelabShellProps) {
  return (
    <Container size="sm" py="md">
      <Group component="header" justify="space-between" wrap="nowrap">
        <Title order={1} miw={0} style={{ overflowWrap: 'anywhere' }}>
          {appName}
        </Title>
        <AccountMenu user={user} logoutUrl={logoutUrl} />
      </Group>
      <Box component="main">{children}</Box>
    </Container>
  )
}

/**
 * My avatar, with my name beside it on wider screens. It opens a panel with who I am, the language
 * and Log out, the things an app rarely needs, so a phone's header holds only the name and this.
 */
function AccountMenu({
  user,
  logoutUrl,
}: Pick<HomelabShellProps, 'user' | 'logoutUrl'>) {
  const t = useUIStrings()
  const logOutDetailId = useId()
  // The visible name is part of the label, so speech input can say what it sees.
  const label = user ? t.accountOf(user.name) : t.account

  return (
    <Popover
      position="bottom-end"
      shadow="md"
      width={260}
      trapFocus
      returnFocus
    >
      <Popover.Target>
        <UnstyledButton aria-label={label}>
          <Group gap="xs" wrap="nowrap">
            {user && (
              <Text fw={500} visibleFrom="xs">
                {user.name}
              </Text>
            )}
            <PersonAvatar name={user?.name} aria-hidden />
          </Group>
        </UnstyledButton>
      </Popover.Target>
      <Popover.Dropdown>
        <Stack>
          {user && (
            <Box miw={0}>
              <Text fw={500} truncate>
                {user.name}
              </Text>
              {user.username !== user.name && (
                <Text size="sm" c="dimmed" truncate>
                  {user.username}
                </Text>
              )}
            </Box>
          )}
          <Stack gap={4}>
            <Text size="sm" fw={500} aria-hidden>
              {t.language}
            </Text>
            <LanguageSwitch />
          </Stack>
          <Stack gap={4}>
            <Button
              component="a"
              href={logoutUrl}
              variant="default"
              aria-describedby={logOutDetailId}
            >
              {t.logOut}
            </Button>
            <Text id={logOutDetailId} size="xs" c="dimmed">
              {t.logOutDetail}
            </Text>
          </Stack>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  )
}
