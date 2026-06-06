import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildTeamSupervisorMap,
  resolveTeamDefaults,
  resolveTeamSupervisorBinding,
} from '../lib/server/teamSupervisors'

type TeamSupervisorRow = {
  team: string
  teamKey: string
  teamFr?: string | null
  teamZh?: string | null
  supervisorId: number
  supervisorName?: string | null
  projectId?: number | null
}

const createClient = (rows: TeamSupervisorRow[]) => {
  const calls: unknown[] = []
  return {
    calls,
    client: {
      teamSupervisor: {
        findMany: async (args: unknown) => {
          calls.push(args)
          return rows
        },
      },
    },
  }
}

test('buildTeamSupervisorMap resolves team aliases to canonical bindings', async () => {
  const { client } = createClient([
    {
      team: 'Team Alpha',
      teamKey: 'team alpha',
      teamFr: 'Equipe Alpha',
      teamZh: '一队',
      supervisorId: 7,
      supervisorName: 'Li Wei',
      projectId: 3,
    },
  ])

  const bindings = await buildTeamSupervisorMap(
    ['Equipe Alpha', '一队', 'Team Alpha'],
    client as never,
  )

  assert.equal(bindings.get('equipe alpha')?.team, 'Team Alpha')
  assert.equal(bindings.get('一队')?.supervisorId, 7)
  assert.equal(bindings.get('team alpha')?.projectId, 3)
})

test('resolveTeamSupervisorBinding rejects ambiguous alias matches', async () => {
  const { client } = createClient([
    {
      team: 'Team Alpha',
      teamKey: 'team alpha',
      teamFr: 'Shared',
      teamZh: null,
      supervisorId: 7,
      projectId: 3,
    },
    {
      team: 'Team Beta',
      teamKey: 'team beta',
      teamFr: 'Shared',
      teamZh: null,
      supervisorId: 8,
      projectId: 4,
    },
  ])

  const binding = await resolveTeamSupervisorBinding('Shared', client as never)

  assert.equal(binding, null)
})

test('resolveTeamSupervisorBinding prefers exact team keys over ambiguous aliases', async () => {
  const { client } = createClient([
    {
      team: 'Shared',
      teamKey: 'shared',
      teamFr: 'Equipe Partagee',
      teamZh: null,
      supervisorId: 7,
      projectId: 3,
    },
    {
      team: 'Team Beta',
      teamKey: 'team beta',
      teamFr: 'Shared',
      teamZh: null,
      supervisorId: 8,
      projectId: 4,
    },
  ])

  const binding = await resolveTeamSupervisorBinding('Shared', client as never)

  assert.equal(binding?.teamKey, 'shared')
  assert.equal(binding?.supervisorId, 7)
})

test('resolveTeamDefaults skips database lookup for empty team names', async () => {
  const { client, calls } = createClient([])

  const defaults = await resolveTeamDefaults('   ', client as never)

  assert.deepEqual(defaults, { supervisorId: null, projectId: null })
  assert.equal(calls.length, 0)
})
