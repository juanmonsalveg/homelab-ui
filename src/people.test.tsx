import { QueryClientProvider } from '@tanstack/react-query'
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createBrowserApiClient } from './client.js'
import { createPeopleQueries, personName, type Person } from './people.js'
import { createQueryClient } from './queryClient.js'
import { renderWithProvider, stubApi } from './test.js'

const ana: Person = { id: 'u1', username: 'ana.r', displayName: 'Ana' }
const luis: Person = { id: 'u2', username: 'luis', displayName: '' }

const { useMe, useUsers, meQuery, usersQuery } = createPeopleQueries(
  createBrowserApiClient('https://auth.example.test'),
)

function People() {
  const me = useMe()
  const users = useUsers()
  if (!me.data || !users.data) return <p>Loading</p>
  return (
    <p>
      {personName(me.data)} with {users.data.map(personName).join(', ')}
    </p>
  )
}

function renderPeople() {
  const queryClient = createQueryClient()
  renderWithProvider(
    <QueryClientProvider client={queryClient}>
      <People />
    </QueryClientProvider>,
  )
  return queryClient
}

describe('personName', () => {
  it('is the display name, or the username without one', () => {
    expect(personName(ana)).toBe('Ana')
    expect(personName(luis)).toBe('luis')
    expect(personName({ username: 'luis', displayName: '  ' })).toBe('luis')
  })
})

describe('the people queries', () => {
  it('load me from GET /api/me and the others from GET /api/users', async () => {
    const api = stubApi(({ path }) => {
      if (path === '/api/me') return Response.json(ana)
      if (path === '/api/users') return Response.json({ users: [luis] })
      return undefined
    })

    renderPeople()

    expect(await screen.findByText('Ana with luis')).toBeInTheDocument()
    expect(api.requests.map((r) => `${r.method} ${r.path}`)).toEqual([
      'GET /api/me',
      'GET /api/users',
    ])
  })

  it('keep me fresh for as long as the page is open', () => {
    expect(meQuery.staleTime).toBe(Infinity)
    expect(meQuery.queryKey).toEqual(['me'])
    expect(usersQuery.queryKey).toEqual(['users'])
  })
})
