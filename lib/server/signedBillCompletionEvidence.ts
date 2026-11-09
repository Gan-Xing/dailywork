import { prisma } from '@/lib/prisma'
import type { SignedCalculationReviewDto } from '@/lib/value/signedBillCalculations'
import { billPeriodIndex, positiveBillInteger } from '@/lib/value/signedBills'

const sourceDate = (date: Date | null) => date?.toISOString().slice(0, 10) ?? '未记录'

const normalizedUnit = (unit: string | null) => {
  const value = unit?.trim().toLowerCase().replace(/²/g, '2').replace(/³/g, '3')
  if (!value) return null
  if (['m', 'ml', '米', '延米'].includes(value)) return 'm'
  if (['m2', '平方米', '平米'].includes(value)) return 'm2'
  if (['m3', '立方米', '方'].includes(value)) return 'm3'
  if (['u', '个', '件', '棵'].includes(value)) return 'u'
  return value
}

/**
 * Existing site records are comparison candidates, not a subtraction from signed bills.
 * A READY_TO_MEASURE record may predate this bill; MEASURED may be user-confirmed
 * without a measurement detail FK. Neither status establishes coverage in this period.
 * Do not use progress getters here: some initialize workflow templates on read.
 */
export async function listSignedBillCompletionCandidates(
  projectId: number,
  periodIndex: number,
): Promise<NonNullable<SignedCalculationReviewDto['completionCandidates']>> {
  positiveBillInteger(projectId, '项目ID')
  billPeriodIndex(periodIndex)
  const records = await prisma.siteVariationMeasurement.findMany({
    where: { projectId, status: { in: ['READY_TO_MEASURE', 'MEASURED'] } },
    select: {
      id: true,
      status: true,
      structureName: true,
      phaseName: true,
      spec: true,
      side: true,
      startPk: true,
      endPk: true,
      unit: true,
      actualQuantity: true,
      proposedQuantity: true,
      occurredAt: true,
      measuredAt: true,
      measurementPeriod: true,
      measurementDetailId: true,
      fieldDescription: true,
      remark: true,
      roadSection: { select: { id: true, name: true } },
      mainRoadSection: { select: { id: true, name: true } },
      boqItem: { select: { code: true, unit: true } },
    },
    orderBy: { id: 'asc' },
  })

  return records.map((record) => {
    const road = record.mainRoadSection && record.roadSection && record.mainRoadSection.id !== record.roadSection.id
      ? `${record.mainRoadSection.name} / ${record.roadSection.name}`
      : record.roadSection?.name ?? record.mainRoadSection?.name ?? null
    const quantity = record.actualQuantity ?? record.proposedQuantity
    const unitConflict = record.unit && record.boqItem?.unit && normalizedUnit(record.unit) !== normalizedUnit(record.boqItem.unit)
    const notes = [
      `现场变更 #${record.id}；源状态 ${record.status}。待与第${periodIndex}期全部明细及以前累计核对，未据源状态自动判定已计量、未计量或完工。`,
      record.structureName,
      record.phaseName ? `分项：${record.phaseName}${record.spec ? `；规格：${record.spec}` : ''}` : null,
      `源发生日期：${sourceDate(record.occurredAt)}；源计量日期：${sourceDate(record.measuredAt)}；源计量期间字段：${sourceDate(record.measurementPeriod)}。发生或签认日期不代表本期账单覆盖范围。`,
      record.measurementDetailId === null ? '未关联正式计量明细；空关联不代表从未计量。' : `源关联计量明细 #${record.measurementDetailId}，仍须核对本期及累计覆盖。`,
      quantity === null ? '源数量未知，保留空白。' : `展示源${record.actualQuantity === null ? '拟计量' : '实际'}数量；不按桩号长度或库存推算。`,
      record.actualQuantity !== null && record.proposedQuantity !== null && !record.actualQuantity.equals(record.proposedQuantity)
        ? `源实际数量 ${record.actualQuantity.toFixed()}；源拟计量数量 ${record.proposedQuantity.toFixed()}，两者不同。` : null,
      unitConflict ? `源单位 ${record.unit} 与绑定清单单位 ${record.boqItem?.unit} 不一致，未作换算，禁止直接相减。` : null,
      record.fieldDescription,
      record.remark,
    ].filter((value): value is string => Boolean(value))

    return {
      id: record.id,
      code: record.boqItem?.code ?? '',
      road,
      side: record.side,
      pkStart: record.startPk,
      pkEnd: record.endPk,
      quantity: quantity?.toFixed() ?? null,
      unit: record.unit,
      note: notes.join('\n'),
      status: '待与本期全部账单明细核对',
    }
  })
}
