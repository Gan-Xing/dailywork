import assert from 'node:assert/strict'
import test from 'node:test'

import {
  clampValueBillViewport,
  deriveValueBillWorkStage,
  formatValueBillPk,
  getValueBillAlignment,
  getValueBillIssueConfirmation,
  getValueBillMeasurementLabel,
  getValueBillMeasurementPeriod,
  getValueBillMeasurementState,
  getValueBillReviewConclusion,
  getValueBillTimelineCoverage,
  getValueBillTimelineSpan,
  isValueBillUnmeasured,
  parseValueBillPk,
  zoomValueBillViewport,
} from '../lib/value/valueBillTimeline'

test('parseValueBillPk parses chainage labels and decimal metres', () => {
  assert.equal(parseValueBillPk('PK2+898.1'), 2898.1)
  assert.equal(parseValueBillPk('0+050'), 50)
  assert.equal(parseValueBillPk('3088'), 3088)
  assert.equal(parseValueBillPk('not-a-pk'), null)
})

test('formatValueBillPk formats metre offsets consistently', () => {
  assert.equal(formatValueBillPk(50), 'PK0+050')
  assert.equal(formatValueBillPk(2898.1), 'PK2+898.1')
})

test('getValueBillTimelineSpan supports ranges, points and corrected issue fields', () => {
  assert.deepEqual(
    getValueBillTimelineSpan({
      recordId: 'range',
      status: 'CONFIRMED',
      data: { pkStart: 'PK0+050', pkEnd: 'PK0+090' },
    }),
    {
      start: 50,
      end: 90,
      startLabel: 'PK0+050',
      endLabel: 'PK0+090',
      isPoint: false,
    },
  )

  assert.equal(
    getValueBillTimelineSpan({
      recordId: 'point',
      status: 'CONFIRMED',
      data: { pk: 'PK0+820' },
    })?.isPoint,
    true,
  )

  assert.equal(
    getValueBillTimelineSpan({
      recordId: 'corrected',
      status: 'NEEDS_REVIEW',
      data: { correctedPkStart: 'PK0+000', correctedPkEnd: 'PK0+220' },
    })?.end,
    220,
  )
})

test('Amorce records use the raw Excel point without becoming mainline ranges', () => {
  const record = {
    recordId: 'ATT6-AMORCE-R716',
    status: 'UNCLEAR',
    source: {
      raw: {
        cells: {
          D: { value: 'AMORCE' },
          E: { value: 2190 },
        },
      },
    },
    data: { type: '平交路口' },
  }

  assert.equal(getValueBillAlignment(record), 'AMORCE')
  assert.deepEqual(getValueBillTimelineSpan(record), {
    start: 2190,
    end: 2190,
    startLabel: 'PK2+190',
    endLabel: 'PK2+190',
    isPoint: true,
  })
  assert.equal(
    getValueBillAlignment({
      recordId: 'ATT6-MAINLINE',
      status: 'CONFIRMED',
      data: { type: '主线账单原始段' },
    }),
    'MAINLINE',
  )
  assert.equal(
    getValueBillAlignment({
      recordId: 'ATT6-RACC',
      status: 'CONFIRMED',
      data: { type: '平交路口（RACC）' },
    }),
    'AMORCE',
  )
})

test('deriveValueBillWorkStage keeps construction and review status separate', () => {
  assert.equal(
    deriveValueBillWorkStage({
      recordId: 'ATT6-UNMEASURED-1',
      status: 'NEEDS_REVIEW',
      data: { measurementStatus: '未计量' },
    }),
    'IN_PROGRESS',
  )
  assert.equal(
    deriveValueBillWorkStage({
      recordId: 'ATT6-MEASURED-1',
      status: 'NEEDS_REVIEW',
      data: { period: '本期计量' },
    }),
    'COMPLETED',
  )
  assert.equal(
    getValueBillMeasurementLabel({
      recordId: 'ATT6-MEASURED-2',
      status: 'CONFIRMED',
      data: { period: '本期计量' },
    }),
    '第六期计量',
  )
  assert.equal(
    getValueBillMeasurementLabel({
      recordId: 'ATT6-LEGACY-MEASURED',
      status: 'CONFIRMED',
      data: { measurementStatus: '已确认' },
    }),
    '已计量',
  )
  assert.equal(
    getValueBillMeasurementState({
      recordId: 'ATT6-UNMEASURED-STATE',
      status: 'NEEDS_REVIEW',
      data: { measurementStatus: '未计量' },
    }),
    'UNMEASURED',
  )
  assert.equal(
    getValueBillMeasurementPeriod({
      recordId: 'ATT6-PREVIOUS-PERIOD',
      status: 'CONFIRMED',
      data: { period: '以前已计量' },
    }),
    'PREVIOUS',
  )
  assert.equal(
    isValueBillUnmeasured({
      recordId: 'ATT6-UNMEASURED-2',
      status: 'NEEDS_REVIEW',
      data: { measurementStatus: '未计量' },
    }),
    true,
  )
  assert.equal(
    isValueBillUnmeasured({
      recordId: 'ATT6-MEASURED-3',
      status: 'CONFIRMED',
      data: { period: '本期计量' },
    }),
    false,
  )
})

test('getValueBillIssueConfirmation separates confirmed issues from pending review', () => {
  assert.equal(
    getValueBillIssueConfirmation({
      recordId: 'ATT6-MEASURED-CONFIRMED-1',
      status: 'CONFIRMED',
      data: { period: '以前已计量' },
    }),
    'CONFIRMED',
  )
  assert.equal(
    getValueBillIssueConfirmation({
      recordId: 'ATT6-UNMEASURED-1',
      status: 'NEEDS_REVIEW',
      data: { measurementStatus: '未计量', userConfirmed: false },
    }),
    'PENDING',
  )
  assert.equal(
    getValueBillIssueConfirmation({
      recordId: 'ATT6-UNMEASURED-CONFIRMED',
      status: 'NEEDS_REVIEW',
      data: { measurementStatus: '未计量', userConfirmed: true },
    }),
    'CONFIRMED',
  )
  assert.equal(
    getValueBillIssueConfirmation({
      recordId: 'ATT6-PENDING-1',
      status: 'UNCLEAR',
      note: '原始账单记录，尚未逐条核对；当前不代表用户已确认。',
      data: { userConfirmed: false },
    }),
    'PENDING',
  )
  assert.equal(
    getValueBillIssueConfirmation({
      recordId: 'ATT6-ISSUE-1',
      status: 'NEEDS_REVIEW',
      note: '用户确认该段有问题。',
    }),
    'CONFIRMED',
  )
  assert.equal(
    getValueBillReviewConclusion({
      recordId: 'ATT6-NORMAL',
      status: 'CONFIRMED',
    }),
    'NORMAL',
  )
  assert.equal(
    getValueBillReviewConclusion({
      recordId: 'ATT6-CONFIRMED-ISSUE',
      status: 'NEEDS_REVIEW',
      data: { userConfirmed: true },
    }),
    'ISSUE',
  )
  assert.equal(
    getValueBillReviewConclusion({
      recordId: 'ATT6-PENDING-ISSUE',
      status: 'NEEDS_REVIEW',
      data: { userConfirmed: false },
    }),
    'PENDING',
  )
  assert.equal(
    getValueBillReviewConclusion({
      recordId: 'ATT6-CONFIRMED-UNMEASURED',
      status: 'NEEDS_REVIEW',
      data: { measurementStatus: '未计量', userConfirmed: true },
    }),
    'TO_MEASURE',
  )
})

test('getValueBillTimelineCoverage merges overlaps and exposes real gaps', () => {
  const coverage = getValueBillTimelineCoverage([
    {
      start: 100,
      end: 200,
      startLabel: 'PK0+100',
      endLabel: 'PK0+200',
      isPoint: false,
    },
    {
      start: 180,
      end: 250,
      startLabel: 'PK0+180',
      endLabel: 'PK0+250',
      isPoint: false,
    },
    {
      start: 300,
      end: 350,
      startLabel: 'PK0+300',
      endLabel: 'PK0+350',
      isPoint: false,
    },
  ], 0, 400)

  assert.deepEqual(coverage.merged, [
    { start: 100, end: 250 },
    { start: 300, end: 350 },
  ])
  assert.deepEqual(coverage.gaps, [
    { start: 0, end: 100, length: 100 },
    { start: 250, end: 300, length: 50 },
    { start: 350, end: 400, length: 50 },
  ])
  assert.equal(coverage.coveredLength, 200)
  assert.equal(coverage.coverageRatio, 0.5)
})

test('viewport helpers keep zoom and pan inside the road range', () => {
  assert.deepEqual(
    clampValueBillViewport({ start: -100, end: 400 }, { start: 0, end: 3088 }),
    { start: 0, end: 500 },
  )
  assert.deepEqual(
    zoomValueBillViewport(
      { start: 0, end: 1000 },
      0.5,
      250,
      { start: 0, end: 3088 },
    ),
    { start: 125, end: 625 },
  )
  assert.deepEqual(
    zoomValueBillViewport(
      { start: 3000, end: 3088 },
      0.1,
      3044,
      { start: 0, end: 3088 },
    ),
    { start: 3034, end: 3054 },
  )
})
