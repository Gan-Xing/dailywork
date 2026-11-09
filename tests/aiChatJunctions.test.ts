import assert from 'node:assert/strict'
import test from 'node:test'
import { Prisma } from '@prisma/client'

import { prisma } from '../lib/prisma'
import { buildJunctionTools } from '../lib/ai-chat/adapters/dailywork/junctionTools'
import {
  MAX_JUNCTION_RECORDS,
  buildJunctionPayload,
  filterJunctionRecords,
  formatJunctionPayload,
  getJunctionIdentities,
  getJunctionIdentity,
  junctionDecimalString,
  junctionSourceUrl,
  mapJunctionQuantity,
  type JunctionRecord,
  type JunctionReview,
} from '../lib/ai-chat/junctionQuantities'
import type { ChatToolContext } from '../lib/ai-chat/types'

const review: JunctionReview = {
  id: 41, key: 'fixture-review', projectCode: 'fixture-project',
  attachmentNumber: 2, sourceFileName: 'fixture.xlsx',
}
const restrictedReview: JunctionReview = {
  ...review, id: 42, key: 'tanda-attachment-6', attachmentNumber: 6,
  sourceFileName: 'ADMIN_ONLY_SOURCE.xlsx',
}
const scope = { reviewKey: review.key, roadSlug: 'fixture-road', side: 'CG' as const, canonicalPk: 'PK1+125' }
const context: ChatToolContext = {
  locale: 'en', session: { id: 1, username: 'fixture-user', permissions: ['value:view'] },
  permissionChecker: async (permission) => permission === 'value:view',
}
const record = (id = 1, overrides: Partial<JunctionRecord> = {}): JunctionRecord => ({
  id, reviewId: review.id, review, recordId: `fixture-record-${String(id).padStart(5, '0')}`,
  status: 'NEEDS_REVIEW', issueId: 'fixture-pending', boqCode: 'BOQ-A', boqNameZh: null,
  boqNameFr: 'Fixture concrete', unit: 'm3', roadSlug: scope.roadSlug, roadZh: null,
  roadRaw: 'Fixture road', sideCode: 'CG', sideZh: null, pkStart: null, pkEnd: null,
  quantity: new Prisma.Decimal('12.1234'), formula: '3 * 4.0411333333', note: 'Fixture review note',
  sourceExcelRow: 25,
  source: { sourceFile: 'fixture.xlsx', sheet: 'Fixture sheet', excelRow: 25, raw: {} },
  data: {
    type: 'Amorce', isJunction: true, side: { code: 'CG' }, canonicalPk: scope.canonicalPk,
    amorce: { canonicalPk: scope.canonicalPk, roadSide: { code: 'CG' }, originalBillPks: ['PK1+129'] },
    quantity: '12.123456789012345678', previousQuantity: null, currentPeriodQuantity: '0',
    unmeasuredQuantity: '12.123456789012345678', formula: '3 * 4.041152263004115226',
    dimensions: [{ name: 'length', value: 3, unit: 'm' }],
    measurementStatus: 'UNMEASURED', period: null,
    userConfirmed: true, reviewConclusion: 'CONFIRMED_PENDING_MEASUREMENT',
  },
  ...overrides,
})
const dataOf = (row: JunctionRecord) => row.data as Prisma.JsonObject
const tool = (name: string) => {
  const result = buildJunctionTools().find((entry) => entry.name === name)
  assert.ok(result)
  return result
}

type QueryArgs = {
  where: Prisma.ValueBillReviewRecordWhereInput
  take?: number
  select?: unknown
  orderBy?: unknown
}
type Calls = { transactions: number; reviews: unknown[]; counts: QueryArgs[]; records: QueryArgs[] }

// No real Prisma method other than the replaced transaction entry point is reachable.
const withSnapshot = async (
  rows: JunctionRecord[],
  run: (calls: Calls) => Promise<void>,
  options: { reviews?: JunctionReview[]; fail?: boolean; total?: number; afterRead?: () => void } = {},
) => {
  const calls: Calls = { transactions: 0, reviews: [], counts: [], records: [] }
  const reviews = options.reviews ?? [review, ...rows.map((row) => row.review)]
  const allowedOnly = <T extends object>(target: T): T => new Proxy(target, {
    get(object, key, receiver) {
      if (!(key in object)) throw new Error(`Unexpected database access: ${String(key)}`)
      return Reflect.get(object, key, receiver)
    },
  })
  const matches = (row: JunctionRecord, where: Prisma.ValueBillReviewRecordWhereInput) => {
    const parent = where.review as { key?: string | { notIn: string[] }; projectCode?: string } | undefined
    if (where.reviewId !== undefined && where.reviewId !== row.reviewId) return false
    if (where.roadSlug !== undefined && where.roadSlug !== row.roadSlug) return false
    if (typeof parent?.key === 'string' && parent.key !== row.review.key) return false
    if (parent?.key && typeof parent.key === 'object' && parent.key.notIn.includes(row.review.key)) return false
    if (parent?.projectCode !== undefined && parent.projectCode !== row.review.projectCode) return false
    if (where.OR) {
      return where.OR.some((entry) => {
        const filter = entry.data as { path: string[]; equals: unknown }
        let value: unknown = row.data
        for (const key of filter.path) value = (value as Record<string, unknown> | null)?.[key]
        return value === filter.equals
      })
    }
    return true
  }
  const tx = allowedOnly({
    valueBillReview: allowedOnly({
      findUnique: async (args: { where: { key: string } }) => {
        calls.reviews.push(args)
        return reviews.find((item) => item.key === args.where.key) ?? null
      },
    }),
    valueBillReviewRecord: allowedOnly({
      count: async (args: QueryArgs) => {
        calls.counts.push(args)
        return options.total ?? rows.filter((row) => matches(row, args.where)).length
      },
      findMany: async (args: QueryArgs) => {
        calls.records.push(args)
        assert.equal(args.take, MAX_JUNCTION_RECORDS)
        assert.deepEqual(args.where, calls.counts.at(-1)?.where)
        assert.ok(args.select)
        assert.ok(args.orderBy)
        const selected = rows.filter((row) => matches(row, args.where)).slice(0, args.take)
        options.afterRead?.()
        return selected
      },
    }),
  })
  const client = prisma as unknown as {
    $transaction: (callback: (transaction: typeof tx) => Promise<unknown>, config: unknown) => Promise<unknown>
  }
  const original = client.$transaction
  client.$transaction = async (callback, config) => {
    calls.transactions += 1
    assert.deepEqual(config, { isolationLevel: 'RepeatableRead' })
    if (options.fail) throw new Error('PRIVATE_DATABASE_DETAIL_DO_NOT_LEAK')
    return callback(tx)
  }
  try {
    await run(calls)
  } finally {
    client.$transaction = original
  }
}

test('junction filtering is exact across project, review, road, side and canonical PK, never source/nearby PK', () => {
  const same = record()
  const rows = [
    same,
    record(2, { review: { ...review, id: 42, key: 'fixture-other-review' }, reviewId: 42 }),
    record(3, { review: { ...review, projectCode: 'fixture-other-project' } }),
    record(4, { roadSlug: 'fixture-road-alias' }),
    record(5, { sideCode: 'CD', data: { ...dataOf(same), amorce: { canonicalPk: scope.canonicalPk, roadSide: { code: 'CD' } } } }),
    record(6, { data: { ...dataOf(same), canonicalPk: 'PK1+126', amorce: { canonicalPk: 'PK1+126', roadSide: { code: 'CG' }, originalBillPks: [scope.canonicalPk] } } }),
    record(7, { pkStart: scope.canonicalPk, data: { type: 'MAINLINE', isJunction: false, canonicalPk: scope.canonicalPk } }),
    record(8, { data: { type: 'Amorce', isJunction: true, pk: scope.canonicalPk, originalBillPk: scope.canonicalPk } }),
    record(9, { data: { ...dataOf(same), canonicalPk: scope.canonicalPk, amorce: { canonicalPk: 'PK1+126', roadSide: { code: 'CG' } } } }),
    record(10, { reviewId: 999 }),
  ]
  const original = formatJunctionPayload(rows)
  assert.deepEqual(filterJunctionRecords(rows, { ...scope, projectCode: review.projectCode }), [same])
  assert.equal(formatJunctionPayload(rows), original, 'Pure filtering must not mutate its inputs')
  assert.deepEqual(filterJunctionRecords(rows, { ...scope, canonicalPk: 'PK1+125.0001' }), [])
  assert.deepEqual(filterJunctionRecords(rows, { ...scope, canonicalPk: 'PK1+129' }), [])
})

test('actual amorce side shapes use the junction side rather than an opposite-side component', () => {
  const variants: Prisma.JsonObject[] = [
    { amorce: { canonicalPk: scope.canonicalPk, roadSide: { code: 'CG' } } },
    { amorce: { canonicalPk: scope.canonicalPk, mainlinePositionSide: { code: 'CG' }, componentSides: ['CD'] } },
    { amorce: { canonicalPk: scope.canonicalPk, sideCode: 'CG' } },
    { canonicalPk: scope.canonicalPk, junctionMainlineSide: { code: 'CG' } },
  ]
  for (const variant of variants) {
    const row = record(1, { sideCode: 'CD', data: { type: 'Amorce', isJunction: true, side: { code: 'CD' }, ...variant } })
    assert.equal(getJunctionIdentity(row)?.side, 'CG')
    assert.equal(filterJunctionRecords([row], scope).length, 1)
    assert.equal(filterJunctionRecords([row], { ...scope, side: 'CD' }).length, 0)
    assert.equal(mapJunctionQuantity(row).recordSide, 'CD')
  }
  assert.equal(getJunctionIdentity(record(1, { data: { isJunction: true, canonicalPk: scope.canonicalPk } }))?.side, 'CG')
  for (const data of [
    { type: 'Amorce', isJunction: false, canonicalPk: scope.canonicalPk },
    { type: 'MAINLINE', isJunction: true, canonicalPk: scope.canonicalPk },
    { type: 'Amorce', isJunction: true, canonicalPk: 'PK1+125-PK1+130' },
  ]) assert.equal(getJunctionIdentity(record(1, { data })), null)
})

test('mapping preserves exact decimal quantities, both dimension shapes, formulas, measurement and confirmation separately', () => {
  const row = record(1, { sourceExcelRow: 88, quantity: new Prisma.Decimal('99999999999999.1234') })
  const mapped = mapJunctionQuantity(row)
  assert.equal(mapped.quantity, '12.123456789012345678')
  assert.equal(mapped.storedQuantity, '99999999999999.1234')
  assert.equal(mapped.quantities.currentPeriodQuantity, '0')
  assert.equal(mapped.quantities.previousQuantity, null)
  assert.equal(mapped.quantities.unmeasuredQuantity, '12.123456789012345678')
  assert.equal(mapped.formula, row.formula)
  assert.deepEqual(mapped.measurement, { status: 'UNMEASURED', period: null })
  assert.equal(mapped.confirmation.userConfirmed, true)
  assert.equal(mapped.confirmation.status, 'NEEDS_REVIEW')
  assert.equal(mapped.confirmation.reviewConclusion, 'CONFIRMED_PENDING_MEASUREMENT')
  assert.equal(mapped.source.excelRow, 88)
  assert.equal(mapped.source.sheet, 'Fixture sheet')
  assert.deepEqual(mapped.dimensions, [{ name: 'length', value: 3, unit: 'm' }])
  const dimensions = { lengthM: 3, widthM: 0.6, segmentLengthsM: [1, 2], lengthFormula: '1+2' }
  const objectMapped = mapJunctionQuantity(record(2, {
    formula: null,
    sourceExcelRow: null,
    data: { ...dataOf(row), dimensions, quantity: '0.000000000000000000000001',
      formula: '2*3*4', quantityComparison: { measuredQuantity: '1e-7', quantityMismatch: true } },
  }))
  assert.deepEqual(objectMapped.dimensions, dimensions)
  assert.equal(objectMapped.quantity, '0.000000000000000000000001')
  assert.equal(objectMapped.formula, '2*3*4')
  assert.equal(objectMapped.source.excelRow, 25)
  assert.deepEqual((objectMapped.details as Record<string, unknown>).quantityComparison, {
    measuredQuantity: '0.0000001', quantityMismatch: true,
  })
  for (const value of [null, undefined, '', '1,234', 'unknown', true, Infinity, NaN]) {
    assert.equal(junctionDecimalString(value), null)
  }
  assert.equal(junctionDecimalString(0), '0')
  assert.equal(junctionDecimalString(1e-8), '0.00000001')
  assert.equal(junctionDecimalString('-2.34567890123456789'), '-2.34567890123456789')
})

test('explicit junction.sideScope is preserved as shared CG/CD coverage, never inferred from a center component', () => {
  const shared = record(1, { sideCode: 'X', data: {
    type: 'Amorce', isJunction: true, canonicalPk: scope.canonicalPk, quantity: '5',
    junction: { canonicalPk: scope.canonicalPk, roadSlug: scope.roadSlug,
      sideScope: [{ code: 'CG' }, { code: 'CD' }, { code: 'X' }] },
  } })
  assert.deepEqual(getJunctionIdentities(shared).map((identity) => identity.side), ['CD', 'CG'])
  for (const side of ['CG', 'CD'] as const) {
    const data = buildJunctionPayload([shared], { ...scope, side })
    assert.equal(data.records?.length, 1)
    assert.equal(data.records[0].side, side)
    assert.equal(data.records[0].quantity, '5')
    assert.equal(data.records[0].sharedAcrossSides, true)
    assert.deepEqual(data.junctions[0].sharedRecordIds, [shared.recordId])
  }
  const list = buildJunctionPayload([shared], {}, 1, 'list')
  assert.equal(list.junctions.length, 2)
  assert.equal(list.recordCoverage.returned, 1, 'Shared records are not counted as two independent quantities')
  assert.equal(getJunctionIdentity(record(2, { sideCode: 'X', data: { isJunction: true, canonicalPk: scope.canonicalPk } })), null)
  assert.equal(getJunctionIdentity(record(3, { sideCode: 'X', data: {
    ...dataOf(shared), junction: { canonicalPk: scope.canonicalPk, roadSlug: 'another-road', sideScope: [{ code: 'CG' }] },
  } })), null)
})

test('photo references combine source.raw, photoBinding and siteEvidence without widening to another junction', () => {
  const row = record(1, {
    source: { raw: { siteEvidenceFileAssetIds: [9, 3, 9, -1, 'untrusted'] } },
    data: { ...dataOf(record()), photoBinding: { fileAssetIds: [5, 3], scope: 'junction' },
      siteEvidence: [{ fileAssetId: 7, apiPath: '/untrusted/path' }, { fileAssetId: 0 }] },
  })
  assert.deepEqual(mapJunctionQuantity(row).photos, [3, 5, 7, 9].map((fileAssetId) => ({
    fileAssetId, url: `/api/files/${fileAssetId}?includeUrl=1`,
  })))
  assert.deepEqual(mapJunctionQuantity(record()).photos, [])
})

test('result sources include safely constructed business pages and file references at the top level', async () => {
  const withPhoto = record(1, { data: { ...dataOf(record()), siteEvidence: [
    { fileAssetId: 15, apiPath: 'https://untrusted.invalid/private' }, { fileAssetId: 15 },
  ] } })
  await withSnapshot([withPhoto], async () => {
    for (const name of ['get_junction_quantities', 'list_bill_junctions']) {
      const result = await tool(name).handler(name === 'get_junction_quantities' ? scope : { projectCode: review.projectCode }, context)
      assert.equal(result.ok, true)
      assert.deepEqual(result.sources, [
        { key: 'value-bill-review', url: junctionSourceUrl(scope) },
        { key: 'value-bill-review-photo', url: '/api/files/15?includeUrl=1' },
      ])
      assert.ok(result.sources.every((source) => source.url.startsWith('/') && !source.url.startsWith('//')))
    }
  })
})

test('source URLs safely encode each path/query identity without changing plus signs or accepting aliases', () => {
  const input = { reviewKey: '../review #?/%', roadSlug: 'road & +/#?', side: 'CG', canonicalPk: 'PK1+125.12345' }
  const url = junctionSourceUrl(input)
  assert.ok(url.startsWith('/value/bill-review/%2E%2E%2Freview%20%23%3F%2F%25?'))
  const parsed = new URL(url, 'https://fixture.invalid')
  assert.equal(parsed.searchParams.get('roadSlug'), input.roadSlug)
  assert.equal(parsed.searchParams.get('canonicalPk'), input.canonicalPk)
  assert.equal(parsed.searchParams.get('side'), input.side)
  for (const reviewKey of ['', '.', '..']) assert.throws(() => junctionSourceUrl({ reviewKey }), /invalid_review_key/)
})

test('tool contracts declare value:view and require a fresh successful handler permission check', async () => {
  await withSnapshot([], async (calls) => {
    for (const entry of buildJunctionTools()) {
      assert.deepEqual(entry.requiredPermissions, ['value:view'])
      assert.equal(entry.resultMode, 'complete')
      assert.equal(entry.effect, 'read')
      let checks = 0
      const revoked = await entry.handler({}, {
        ...context, permissionChecker: async (permission) => { checks++; assert.equal(permission, 'value:view'); return false },
      })
      assert.equal(revoked.error, 'permission_denied')
      assert.equal(checks, 1)
      assert.equal((await entry.handler({}, { ...context, permissionChecker: undefined })).error, 'permission_denied')
      assert.equal((await entry.handler({}, { ...context, session: null })).error, 'permission_denied')
      assert.equal((await entry.handler({}, { ...context, permissionChecker: async () => { throw new Error('private') } })).error, 'permission_denied')
    }
    assert.equal(calls.transactions, 0)
  })
})

const restrictedRoleChecks: Array<{
  name: string
  checker: ChatToolContext['roleChecker']
}> = [
  { name: 'missing', checker: undefined },
  { name: 'false', checker: async () => false },
  { name: 'failed', checker: async () => { throw new Error('PRIVATE_ROLE_CHECK_DETAIL') } },
  { name: 'non-boolean', checker: async () => 'Admin' as unknown as boolean },
]

for (const { name, checker } of restrictedRoleChecks) {
  test(`restricted exact review fails closed before database access when Admin check is ${name}`, async () => {
    await withSnapshot([], async (calls) => {
      for (const entry of buildJunctionTools()) {
        const args = entry.name === 'list_bill_junctions'
          ? { projectCode: review.projectCode, reviewKey: restrictedReview.key }
          : { ...scope, reviewKey: restrictedReview.key }
        const result = await entry.handler(args, { ...context, roleChecker: checker })
        assert.equal(result.ok, false)
        assert.equal(result.error, 'permission_denied')
        assert.equal(result.data, undefined)
        assert.equal(result.sources, undefined)
        assert.equal(result.answer, undefined)
        assert.equal(result.content.includes('PRIVATE_ROLE_CHECK_DETAIL'), false)
      }
      assert.equal(calls.transactions, 0)
      assert.deepEqual(calls.reviews, [])
      assert.deepEqual(calls.counts, [])
      assert.deepEqual(calls.records, [])
    })
  })

  test(`project lists exclude restricted reviews before count and bounded read when Admin check is ${name}`, async () => {
    const hidden = record(2, { reviewId: restrictedReview.id, review: restrictedReview })
    await withSnapshot([hidden, record()], async (calls) => {
      const result = await tool('list_bill_junctions').handler({ projectCode: review.projectCode }, {
        ...context, roleChecker: checker,
      })
      assert.equal(result.ok, true)
      const data = result.data as ReturnType<typeof buildJunctionPayload>
      assert.deepEqual(data.junctions.map((item) => item.reviewKey), [review.key])
      assert.equal(data.recordCoverage.total, 1)
      assert.equal(data.recordCoverage.returned, 1)
      const expected = { review: { key: { notIn: [restrictedReview.key] }, projectCode: review.projectCode } }
      assert.deepEqual(calls.counts[0].where, expected)
      assert.deepEqual(calls.records[0].where, expected)
      assert.deepEqual(calls.reviews, [])
      for (const secret of [restrictedReview.key, restrictedReview.sourceFileName, 'PRIVATE_ROLE_CHECK_DETAIL']) {
        assert.equal(JSON.stringify(result).includes(secret!), false)
      }
    })
  })
}

test('a fresh Admin role check authorizes restricted exact reads and project enumeration', async () => {
  const hidden = record(2, { reviewId: restrictedReview.id, review: restrictedReview })
  const roles: string[] = []
  const adminContext: ChatToolContext = { ...context, roleChecker: async (role) => { roles.push(role); return true } }
  await withSnapshot([hidden, record()], async (calls) => {
    for (const entry of buildJunctionTools()) {
      const args = entry.name === 'list_bill_junctions'
        ? { projectCode: review.projectCode, reviewKey: restrictedReview.key }
        : { ...scope, reviewKey: restrictedReview.key }
      const result = await entry.handler(args, adminContext)
      assert.equal(result.ok, true)
      const data = result.data as ReturnType<typeof buildJunctionPayload>
      assert.equal(data.junctions[0].reviewKey, restrictedReview.key)
      assert.equal(data.recordCoverage.total, 1)
      assert.equal(calls.records.at(-1)?.where.reviewId, restrictedReview.id)
      assert.deepEqual(data.junctions[0].recordIds, [hidden.recordId])
    }
    const listed = await tool('list_bill_junctions').handler({ projectCode: review.projectCode }, adminContext)
    const data = listed.data as ReturnType<typeof buildJunctionPayload>
    assert.equal(listed.ok, true)
    assert.deepEqual(new Set(data.junctions.map((item) => item.reviewKey)), new Set([review.key, restrictedReview.key]))
    assert.equal(data.recordCoverage.total, 2)
    assert.deepEqual(calls.counts.at(-1)?.where, { review: { projectCode: review.projectCode } })
    assert.deepEqual(roles, Array(6).fill('Admin'))
  })
})

for (const { name, checker } of restrictedRoleChecks) {
  for (const request of [
    { name: 'restricted quantities', tool: 'get_junction_quantities', args: { ...scope, reviewKey: restrictedReview.key } },
    { name: 'restricted exact list', tool: 'list_bill_junctions', args: { projectCode: review.projectCode, reviewKey: restrictedReview.key } },
    { name: 'project-wide list', tool: 'list_bill_junctions', args: { projectCode: review.projectCode } },
  ]) {
    test(`${request.name} discloses no data or counts when the post-snapshot Admin check is ${name}`, async () => {
      const hidden = record(2, { reviewId: restrictedReview.id, review: restrictedReview })
      const roles: string[] = []
      const actor: ChatToolContext = {
        ...context, roleChecker: async (role) => { roles.push(role); return true },
      }
      await withSnapshot([hidden, record()], async (calls) => {
        const result = await tool(request.tool).handler(request.args, actor)
        assert.deepEqual(result, {
          ok: false, error: 'permission_denied', content: 'A fresh Admin role check is required for this review.',
        })
        assert.equal(calls.transactions, 1)
        assert.equal(calls.counts.length, 1)
        assert.equal(calls.records.length, 1)
        assert.deepEqual(roles, Array(checker ? 2 : 1).fill('Admin'))
        assert.equal(await actor.permissionChecker?.('value:view'), true, 'Business permission remains granted')
      }, {
        afterRead: () => {
          assert.deepEqual(roles, ['Admin'])
          actor.roleChecker = checker && (async (role) => { roles.push(role); return checker(role) })
        },
      })
    })
  }
}

test('restricted review access still requires value:view even for Admin', async () => {
  await withSnapshot([], async (calls) => {
    let roleChecks = 0
    for (const entry of buildJunctionTools()) {
      const result = await entry.handler({ ...scope, projectCode: review.projectCode, reviewKey: restrictedReview.key }, {
        ...context, permissionChecker: async () => false, roleChecker: async () => { roleChecks++; return true },
      })
      assert.equal(result.error, 'permission_denied')
    }
    assert.equal(roleChecks, 0)
    assert.equal(calls.transactions, 0)
  })
})

test('unrestricted exact reviews do not depend on an Admin role check', async () => {
  await withSnapshot([record()], async () => {
    let roleChecks = 0
    for (const entry of buildJunctionTools()) {
      const args = entry.name === 'list_bill_junctions' ? { projectCode: review.projectCode, reviewKey: review.key } : scope
      const result = await entry.handler(args, {
        ...context, roleChecker: async () => { roleChecks++; throw new Error('Role service unavailable') },
      })
      assert.equal(result.ok, true)
    }
    assert.equal(roleChecks, 0)
  })
})

test('restricted rows cannot consume the non-Admin list limit or inflate coverage', async () => {
  const hidden = Array.from({ length: MAX_JUNCTION_RECORDS }, (_, index) => record(index + 2, {
    reviewId: restrictedReview.id, review: restrictedReview,
  }))
  await withSnapshot([...hidden, record()], async () => {
    const result = await tool('list_bill_junctions').handler({ projectCode: review.projectCode }, context)
    const data = result.data as ReturnType<typeof buildJunctionPayload>
    assert.equal(result.ok, true)
    assert.deepEqual(data.junctions.map((item) => item.reviewKey), [review.key])
    assert.equal(data.recordCoverage.total, 1)
    assert.equal(data.recordCoverage.returned, 1)
    assert.equal(data.coverage.complete, true)
  })
})

test('revoked Admin status is rechecked for exact requests and subsequent project lists', async () => {
  const hidden = record(2, { reviewId: restrictedReview.id, review: restrictedReview })
  let isAdmin = true
  const actor: ChatToolContext = { ...context, roleChecker: async (role) => role === 'Admin' && isAdmin }
  await withSnapshot([hidden, record()], async (calls) => {
    const exact = { ...scope, reviewKey: restrictedReview.key }
    assert.equal((await tool('get_junction_quantities').handler(exact, actor)).ok, true)
    isAdmin = false
    assert.equal((await tool('get_junction_quantities').handler(exact, actor)).error, 'permission_denied')
    assert.equal((await tool('list_bill_junctions').handler({ projectCode: review.projectCode, reviewKey: restrictedReview.key }, actor)).error, 'permission_denied')
    assert.equal(calls.transactions, 1)
    const listed = await tool('list_bill_junctions').handler({ projectCode: review.projectCode }, actor)
    assert.deepEqual((listed.data as ReturnType<typeof buildJunctionPayload>).junctions.map((item) => item.reviewKey), [review.key])
    assert.equal(calls.transactions, 2)
  })
})

test('invalid or approximate arguments fail before Prisma and never normalize aliases', async () => {
  await withSnapshot([], async (calls) => {
    for (const args of [
      {}, { ...scope, side: 'left' }, { ...scope, side: 'cg' }, { ...scope, side: 'X' },
      { ...scope, canonicalPk: 1125 }, { ...scope, canonicalPk: '1125' },
      { ...scope, canonicalPk: 'pk1+125' }, { ...scope, canonicalPk: 'PK1+125 extra' },
      { ...scope, canonicalPk: 'PK1+125-PK1+126' }, { ...scope, reviewKey: ' fixture-review' },
      { ...scope, reviewKey: '.' }, { ...scope, reviewKey: '..' },
      { ...scope, roadSlug: '' }, { ...scope, roadSlug: 'bad\nroad' },
      { ...scope, canonicalPk: 'PK1+25' }, { ...scope, canonicalPk: 'PK01+125' },
    ]) assert.equal((await tool('get_junction_quantities').handler(args, context)).error, 'invalid_arguments')
    for (const args of [{}, { projectCode: null }, { projectCode: review.projectCode, reviewKey: null },
      { projectCode: review.projectCode, roadSlug: ' road' }, { projectCode: review.projectCode, reviewKey: '..' }]) {
      assert.equal((await tool('list_bill_junctions').handler(args, context)).error, 'invalid_arguments')
    }
    assert.equal(calls.transactions, 0)
  })
})

test('quantity tools select exact review and scoped road inside RepeatableRead and return every matching BOQ record', async () => {
  const row = record()
  const rows = [
    row,
    record(2, { boqCode: 'BOQ-B', sourceExcelRow: 26 }),
    record(3, { roadSlug: 'other-road' }),
    record(4, { data: { ...dataOf(row), amorce: { canonicalPk: scope.canonicalPk, roadSide: { code: 'CD' } } } }),
    record(5, { data: { type: 'MAINLINE', isJunction: false, canonicalPk: scope.canonicalPk } }),
    record(6, { reviewId: 42, review: { ...review, id: 42, key: 'other-review' } }),
  ]
  await withSnapshot(rows, async (calls) => {
    const entry = tool('get_junction_quantities')
    const result = await entry.handler(scope, { ...context, session: { ...context.session!, permissions: [] } })
    assert.equal(result.ok, true, 'Fresh checker, not stale session permissions, is authoritative')
    const data = result.data as ReturnType<typeof buildJunctionPayload>
    assert.deepEqual(data.records?.map((item) => item.recordId), [row.recordId, rows[1].recordId])
    assert.deepEqual(data.coverage, { complete: true, total: 2, returned: 2, reason: 'all_matching_records_returned' })
    assert.deepEqual(calls.reviews[0], {
      where: { key: review.key },
      select: { id: true, key: true, projectCode: true, attachmentNumber: true, sourceFileName: true },
    })
    assert.deepEqual(calls.records[0].where, {
      reviewId: review.id, review: { key: review.key }, roadSlug: scope.roadSlug,
      OR: [{ data: { path: ['canonicalPk'], equals: scope.canonicalPk } },
        { data: { path: ['amorce', 'canonicalPk'], equals: scope.canonicalPk } },
        { data: { path: ['junction', 'canonicalPk'], equals: scope.canonicalPk } }],
    })
    assert.deepEqual(JSON.parse(result.content), data)
    assert.equal(entry.formatResult?.(result), result.content)
    assert.equal(data.preserveFullContent, true)
    assert.deepEqual(result.sources, data.sources)
    assert.ok(data.sources[0].url.startsWith('/value/bill-review/'))
    assert.equal(calls.transactions, 1)
  })
})

test('junction listing keeps reviews, roads and sides distinct with exact optional scope', async () => {
  const rows = [record(), record(2, { boqCode: 'BOQ-B' }),
    record(3, { reviewId: 42, review: { ...review, id: 42, key: 'fixture-other-review' } }),
    record(4, { roadSlug: 'other-road' }),
    record(5, { reviewId: 43, review: { ...review, id: 43, projectCode: 'other-project' } })]
  await withSnapshot(rows, async (calls) => {
    const entry = tool('list_bill_junctions')
    const result = await entry.handler({ projectCode: review.projectCode }, context)
    const data = result.data as ReturnType<typeof buildJunctionPayload>
    assert.equal(data.junctions.length, 3)
    assert.equal(data.recordCoverage.returned, 4)
    assert.deepEqual(data.junctions.find((item) => item.reviewKey === review.key && item.roadSlug === scope.roadSlug)?.recordIds,
      [rows[0].recordId, rows[1].recordId])
    assert.deepEqual(calls.records[0].where, {
      review: { key: { notIn: [restrictedReview.key] }, projectCode: review.projectCode },
    })
    const scoped = await entry.handler({ projectCode: review.projectCode, reviewKey: review.key, roadSlug: scope.roadSlug }, context)
    const narrowed = scoped.data as ReturnType<typeof buildJunctionPayload>
    assert.equal(narrowed.junctions.length, 1)
    assert.equal(narrowed.recordCoverage.total, 2)
    const wrongProject = await entry.handler({ projectCode: 'wrong-project', reviewKey: review.key }, context)
    assert.equal((wrongProject.data as ReturnType<typeof buildJunctionPayload>).status, 'not_found_record')
    assert.equal(calls.records.length, 2, 'A project/review mismatch must never query another review')
  })
})

test('not_found_record is explicit and never concludes physically_absent, including missing reviews', async () => {
  await withSnapshot([record()], async () => {
    for (const args of [{ ...scope, canonicalPk: 'PK1+125.0001' }, { ...scope, roadSlug: 'unknown-road' },
      { ...scope, reviewKey: 'unknown-review' }]) {
      const result = await tool('get_junction_quantities').handler(args, context)
      assert.equal(result.ok, true)
      const data = result.data as ReturnType<typeof buildJunctionPayload>
      assert.equal(data.status, 'not_found_record')
      assert.equal(data.physicalPresence, 'unknown')
      assert.equal(data.coverage.total, 0)
      assert.equal(data.coverage.reason, 'not_found_record')
      assert.match(data.notice, /not_found_record is not physically_absent/)
      assert.equal(data.sources.length, 1)
    }
  })
})

test('over 1000 scoped candidates are bounded and partial with unknown matching totals, never a complete/absence claim', async () => {
  const rows = Array.from({ length: MAX_JUNCTION_RECORDS + 1 }, (_, index) => record(index + 1))
  await withSnapshot(rows, async (calls) => {
    const result = await tool('get_junction_quantities').handler(scope, context)
    const data = result.data as ReturnType<typeof buildJunctionPayload>
    assert.equal(result.ok, true)
    assert.equal(data.status, 'partial')
    assert.deepEqual(data.coverage, { complete: false, total: null, returned: 1000, reason: 'scope_limit_exceeded' })
    assert.equal(data.records?.length, 1000)
    assert.equal(data.candidateTotal, 1001)
    assert.equal(data.scanned, 1000)
    assert.equal(calls.records[0].take, 1000)
    const list = await tool('list_bill_junctions').handler({ projectCode: review.projectCode }, context)
    const listed = list.data as ReturnType<typeof buildJunctionPayload>
    assert.equal(listed.coverage.complete, false)
    assert.equal(listed.coverage.total, null)
    assert.equal(listed.recordCoverage.returned, 1000)
  })
  const hidden = rows.map((row, index) => index === 1000 ? row : record(row.id, {
    data: { ...dataOf(row), amorce: { canonicalPk: scope.canonicalPk, roadSide: { code: 'CD' } } },
  }))
  await withSnapshot(hidden, async () => {
    const data = (await tool('get_junction_quantities').handler(scope, context)).data as ReturnType<typeof buildJunctionPayload>
    assert.equal(data.coverage.returned, 0)
    assert.equal(data.coverage.total, null)
    assert.equal(data.status, 'partial', 'A match outside the bound cannot become not_found_record')
  })
  const exact = buildJunctionPayload(rows.slice(0, MAX_JUNCTION_RECORDS), scope)
  assert.equal(exact.coverage.complete, true)
  assert.equal(exact.coverage.total, MAX_JUNCTION_RECORDS)
})

test('full deterministic content contains every formula and long detail without generic summary truncation', async () => {
  const longFormula = `FULL_DETAIL_START${' + component'.repeat(1200)}FULL_DETAIL_END`
  const rows = [record(2, { boqCode: 'BOQ-B', data: { ...dataOf(record()), formula: longFormula } }), record(1)]
  const forward = buildJunctionPayload(rows, scope)
  const reversed = buildJunctionPayload([...rows].reverse(), scope)
  assert.equal(formatJunctionPayload(forward), formatJunctionPayload(reversed))
  await withSnapshot(rows, async () => {
    const result = await tool('get_junction_quantities').handler(scope, context)
    assert.ok(result.content.length > 14000)
    assert.ok(result.content.includes(longFormula))
    assert.deepEqual(JSON.parse(result.content), result.data)
    assert.equal(result.content.includes('...'), false)
  })
})

test('snapshot failures return no private database diagnostics or false absence claims', async () => {
  await withSnapshot([], async () => {
    for (const name of ['get_junction_quantities', 'list_bill_junctions']) {
      const result = await tool(name).handler(name === 'get_junction_quantities' ? scope : { projectCode: review.projectCode }, context)
      assert.equal(result.ok, false)
      assert.equal(result.error, 'query_failed')
      assert.equal(result.data, undefined)
      assert.equal(result.content.includes('PRIVATE_DATABASE_DETAIL'), false)
      assert.equal(result.content.includes('not_found_record'), false)
    }
  }, { fail: true })
})
