// The people in a homelab app (README.md §4): who I am (GET /api/me) and everyone else who has
// opened the app (GET /api/users), as homelab-go's auth handlers answer them.
import { queryOptions, useQuery } from '@tanstack/react-query'
import type { ApiClient } from './client.js'

/** Someone with an Authelia account who has opened the app. */
export interface Person {
  id: string
  username: string
  /** Empty when Authelia has no display name: show the username then (personName). */
  displayName: string
}

/** The name to show for someone: their display name, or their username without one. */
export function personName(person: Pick<Person, 'username' | 'displayName'>) {
  return person.displayName.trim() || person.username
}

/** The people queries, on the app's API client. Create them once, next to the client. */
export function createPeopleQueries(api: Pick<ApiClient, 'get'>) {
  /**
   * Who I am. A different login reloads the page, so the answer never goes stale while the app is
   * open. For queryClient.fetchQuery when a write needs my id whether or not the screen has it.
   */
  const meQuery = queryOptions({
    queryKey: ['me'],
    queryFn: ({ signal }) => api.get<Person>('/api/me', signal),
    staleTime: Infinity,
  })

  /** Everyone who has opened the app except me, by name. */
  const usersQuery = queryOptions({
    queryKey: ['users'],
    queryFn: async ({ signal }) =>
      (await api.get<{ users: Person[] }>('/api/users', signal)).users,
  })

  /** Who I am, loaded only while `enabled`. */
  function useMe({ enabled = true }: { enabled?: boolean } = {}) {
    return useQuery({ ...meQuery, enabled })
  }

  function useUsers() {
    return useQuery(usersQuery)
  }

  return { meQuery, usersQuery, useMe, useUsers }
}
