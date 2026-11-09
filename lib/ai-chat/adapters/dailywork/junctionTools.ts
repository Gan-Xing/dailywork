import { Prisma } from '@prisma/client'

import { prisma } from '../../../prisma'
import {
  MAX_JUNCTION_RECORDS,
  buildJunctionPayload,
  formatJunctionPayload,
  isCanonicalJunctionPk,
  junctionSourceUrl,
  renderJunctionAnswer,
  type JunctionScope,
} from '../../junctionQuantities'
import type { ChatTool, ChatToolContext, ChatToolResult } from '../../types'

const reviewSelect = {
  id: true, key: true, projectCode: true, attachmentNumber: true, sourceFileName: true,
} satisfies Prisma.ValueBillReviewSelect

const recordSelect = {
  id: true, reviewId: true, recordId: true, status: true, issueId: true,
  boqCode: true, boqNameZh: true, boqNameFr: true, unit: true,
  roadSlug: true, roadZh: true, roadRaw: true, sideCode: true, sideZh: true,
  pkStart: true, pkEnd: true, quantity: true, formula: true, note: true,
  sourceExcelRow: true, source: true, data: true, review: { select: reviewSelect },
} satisfies Prisma.ValueBillReviewRecordSelect

const validExactString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= 512
  && value.trim() === value && !/[\u0000-\u001f\u007f]/.test(value)

const validReviewKey = (value: unknown): value is string =>
  validExactString(value) && value !== '.' && value !== '..'

const adminOnlyReviewKeys = ['tanda-attachment-6']

const denied = (): ChatToolResult => ({
  ok: false, error: 'permission_denied', content: 'A fresh value:view permission check is required.',
})

const restrictedReviewDenied = (): ChatToolResult => ({
  ok: false, error: 'permission_denied', content: 'A fresh Admin role check is required for this review.',
})

const canView = async (context: ChatToolContext) => {
  if (!context.session || !context.permissionChecker) return false
  try {
    return await context.permissionChecker('value:view') === true
  } catch {
    return false
  }
}

const canViewRestrictedReviews = async (context: ChatToolContext) => {
  try {
    return await context.roleChecker?.('Admin') === true
  } catch {
    return false
  }
}

const invalid = (): ChatToolResult => ({
  ok: false,
  error: 'invalid_arguments',
  content: 'Use exact projectCode/reviewKey/roadSlug, side CG or CD, and the canonical PK returned by list_bill_junctions. No aliases or nearby-PK matching.',
})

const queryFailure = (): ChatToolResult => ({
  ok: false,
  error: 'query_failed',
  content: 'The read-only snapshot query failed. No absence or completeness conclusion can be drawn.',
})

const readSnapshot = async (scope: JunctionScope, mode: 'list' | 'quantities', includeRestricted = false) =>
  prisma.$transaction(async (tx) => {
    let reviewId: number | undefined
    if (scope.reviewKey !== undefined) {
      const review = await tx.valueBillReview.findUnique({
        where: { key: scope.reviewKey }, select: reviewSelect,
      })
      if (!review || (scope.projectCode !== undefined && review.projectCode !== scope.projectCode)) {
        const payload = buildJunctionPayload([], scope, 0, mode)
        payload.sources = [{ key: 'value-bill-review', url: junctionSourceUrl({ reviewKey: scope.reviewKey, roadSlug: scope.roadSlug }) }]
        return payload
      }
      reviewId = review.id
    }
    const where: Prisma.ValueBillReviewRecordWhereInput = {
      ...(reviewId !== undefined ? { reviewId } : {}),
      review: {
        ...(scope.reviewKey !== undefined
          ? { key: scope.reviewKey }
          : includeRestricted ? {} : { key: { notIn: adminOnlyReviewKeys } }),
        ...(scope.projectCode !== undefined ? { projectCode: scope.projectCode } : {}),
      },
      ...(scope.roadSlug !== undefined ? { roadSlug: scope.roadSlug } : {}),
      ...(scope.canonicalPk !== undefined ? {
        OR: [
          { data: { path: ['canonicalPk'], equals: scope.canonicalPk } },
          { data: { path: ['amorce', 'canonicalPk'], equals: scope.canonicalPk } },
          { data: { path: ['junction', 'canonicalPk'], equals: scope.canonicalPk } },
        ],
      } : {}),
    }
    // Count and bounded reads share one snapshot. Partial totals are unknown matching
    // totals, not the candidate count, since canonical side filtering is pure below.
    const total = await tx.valueBillReviewRecord.count({ where })
    const records = await tx.valueBillReviewRecord.findMany({
      where,
      select: recordSelect,
      orderBy: [{ reviewId: 'asc' }, { roadSlug: 'asc' }, { recordId: 'asc' }, { id: 'asc' }],
      take: MAX_JUNCTION_RECORDS,
    })
    const payload = buildJunctionPayload(records, scope, total, mode)
    if (!payload.sources.length && scope.reviewKey !== undefined) {
      payload.sources = [{ key: 'value-bill-review', url: junctionSourceUrl({ reviewKey: scope.reviewKey, roadSlug: scope.roadSlug }) }]
    }
    return payload
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead })

const success = (data: Awaited<ReturnType<typeof readSnapshot>>, locale = 'zh'): ChatToolResult => ({
  ok: true, content: formatJunctionPayload(data), data, sources: data.sources, answer: renderJunctionAnswer(data, locale),
})

export const buildJunctionTools = (): ChatTool[] => [
  {
    name: 'list_bill_junctions',
    description: 'Read-only list of canonical Amorce junctions for an exact projectCode, optionally an exact reviewKey and roadSlug. Use the returned identity for quantity queries; never infer nearby-PK or road aliases. Coverage is database-record coverage only; partial results are not exhaustive.',
    requiredPermissions: ['value:view'],
    effect: 'read',
    resultMode: 'complete',
    schema: {
      type: 'object',
      properties: {
        projectCode: { type: 'string', description: 'Exact ValueBillReview.projectCode, not a project name or alias.' },
        reviewKey: { type: 'string', description: 'Optional exact review key. Omission lists reviews separately, never merging them.' },
        roadSlug: { type: 'string', description: 'Optional exact stored road slug; no slug aliases.' },
      },
      required: ['projectCode'],
    },
    handler: async (args, context) => {
      if (!await canView(context)) return denied()
      if (!validExactString(args.projectCode)
        || (args.reviewKey !== undefined && !validReviewKey(args.reviewKey))
        || (args.roadSlug !== undefined && !validExactString(args.roadSlug))) return invalid()
      const scope: JunctionScope = { projectCode: args.projectCode }
      if (typeof args.reviewKey === 'string') scope.reviewKey = args.reviewKey
      if (typeof args.roadSlug === 'string') scope.roadSlug = args.roadSlug
      const restricted = scope.reviewKey !== undefined && adminOnlyReviewKeys.includes(scope.reviewKey)
      const includeRestricted = (scope.reviewKey === undefined || restricted) && await canViewRestrictedReviews(context)
      if (restricted && !includeRestricted) return restrictedReviewDenied()
      try {
        const snapshot = await readSnapshot(scope, 'list', includeRestricted)
        if (includeRestricted && !await canViewRestrictedReviews(context)) return restrictedReviewDenied()
        return success(snapshot, context.locale)
      } catch {
        return queryFailure()
      }
    },
    formatResult: (result) => result.content,
  },
  {
    name: 'get_junction_quantities',
    description: 'Read-only full quantity records for one exact reviewKey, roadSlug, mainline junction side CG/CD and canonicalPk. Preserves decimal quantities, all item-specific formulas/dimensions, measurement separately from confirmation, Excel provenance and photo references. No approximate matching; not_found_record does not mean physically_absent. At most 1000 candidates, with explicit partial coverage beyond that bound.',
    requiredPermissions: ['value:view'],
    effect: 'read',
    resultMode: 'complete',
    schema: {
      type: 'object',
      properties: {
        reviewKey: { type: 'string', description: 'Exact ValueBillReview.key from list_bill_junctions.' },
        roadSlug: { type: 'string', description: 'Exact stored road slug from list_bill_junctions.' },
        side: { type: 'string', enum: ['CG', 'CD'], description: 'Canonical mainline junction side, not component side.' },
        canonicalPk: { type: 'string', description: 'Exact canonical PK, e.g. PK0+070. No source PK, range, normalization or nearest match.' },
      },
      required: ['reviewKey', 'roadSlug', 'side', 'canonicalPk'],
    },
    handler: async (args, context) => {
      if (!await canView(context)) return denied()
      if (!validReviewKey(args.reviewKey) || !validExactString(args.roadSlug)
        || (args.side !== 'CG' && args.side !== 'CD')
        || !validExactString(args.canonicalPk) || !isCanonicalJunctionPk(args.canonicalPk)) return invalid()
      const restricted = adminOnlyReviewKeys.includes(args.reviewKey)
      if (restricted && !await canViewRestrictedReviews(context)) {
        return restrictedReviewDenied()
      }
      try {
        const snapshot = await readSnapshot({
          reviewKey: args.reviewKey, roadSlug: args.roadSlug, side: args.side, canonicalPk: args.canonicalPk,
        }, 'quantities')
        if (restricted && !await canViewRestrictedReviews(context)) return restrictedReviewDenied()
        return success(snapshot, context.locale)
      } catch {
        return queryFailure()
      }
    },
    formatResult: (result) => result.content,
  },
]
