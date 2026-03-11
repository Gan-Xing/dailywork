import type { DocumentStatus, InspectionStatus } from '@prisma/client'

import {
  executeSubmissionBatch,
  previewSubmissionBatch,
  type SubmissionBatchInput,
} from '@/lib/server/submissionBatchStore'

const usage = `Usage:\n  pnpm exec tsx scripts/submission-batch.ts preview <<'JSON'\n  {\n    "inspectionStatuses": ["SCHEDULED"],\n    "unboundOnly": true,\n    "packingPolicy": "road-first-then-12",\n    "statusAfterBind": "APPROVED"\n  }\n  JSON\n\n  pnpm exec tsx scripts/submission-batch.ts execute <<'JSON'\n  {\n    "inspectionStatuses": ["SCHEDULED"],\n    "unboundOnly": true,\n    "packingPolicy": "road-first-then-12",\n    "statusAfterBind": "APPROVED"\n  }\n  JSON`

const readStdin = async () => {
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)))
  }
  return Buffer.concat(chunks).toString('utf8').trim()
}

const normalizeInput = (raw: Record<string, unknown>): SubmissionBatchInput & { userId?: number | null } => {
  const inspectionStatuses = Array.isArray(raw.inspectionStatuses)
    ? (raw.inspectionStatuses as InspectionStatus[])
    : Array.isArray(raw.statuses)
      ? (raw.statuses as InspectionStatus[])
      : Array.isArray(raw.status)
        ? (raw.status as InspectionStatus[])
        : undefined

  const inspectionIds = Array.isArray(raw.inspectionIds)
    ? raw.inspectionIds.map((value) => Number(value)).filter((value) => Number.isFinite(value) && value > 0)
    : Array.isArray(raw.ids)
      ? raw.ids.map((value) => Number(value)).filter((value) => Number.isFinite(value) && value > 0)
      : undefined

  return {
    inspectionIds,
    inspectionStatuses,
    unboundOnly: raw.unboundOnly === undefined ? undefined : Boolean(raw.unboundOnly),
    roadIds: Array.isArray(raw.roadIds)
      ? raw.roadIds.map((value) => Number(value)).filter((value) => Number.isFinite(value) && value > 0)
      : undefined,
    phaseIds: Array.isArray(raw.phaseIds)
      ? raw.phaseIds.map((value) => Number(value)).filter((value) => Number.isFinite(value) && value > 0)
      : undefined,
    title: typeof raw.title === 'string' ? raw.title : undefined,
    subject: typeof raw.subject === 'string' ? raw.subject : undefined,
    documentStatus: raw.documentStatus as DocumentStatus | undefined,
    statusAfterBind: raw.statusAfterBind as SubmissionBatchInput['statusAfterBind'],
    packingPolicy: raw.packingPolicy as SubmissionBatchInput['packingPolicy'],
    sortPolicy: raw.sortPolicy as SubmissionBatchInput['sortPolicy'],
    maxRows: Number.isFinite(Number(raw.maxRows)) ? Number(raw.maxRows) : undefined,
    templateId: typeof raw.templateId === 'string' ? raw.templateId : raw.templateId === null ? null : undefined,
    userId: Number.isFinite(Number(raw.userId)) ? Number(raw.userId) : raw.userId === null ? null : undefined,
  }
}

const main = async () => {
  const args = process.argv.slice(2).filter((arg) => arg !== '--')
  const mode = args[0]
  if (mode !== 'preview' && mode !== 'execute') {
    console.error(usage)
    process.exit(1)
  }

  const stdin = await readStdin()
  if (!stdin) {
    console.error('Missing JSON input')
    console.error(usage)
    process.exit(1)
  }

  let payload: SubmissionBatchInput & { userId?: number | null }
  try {
    payload = normalizeInput(JSON.parse(stdin) as Record<string, unknown>)
  } catch (error) {
    console.error(`Invalid JSON input: ${(error as Error).message}`)
    process.exit(1)
  }

  const result =
    mode === 'preview'
      ? await previewSubmissionBatch(payload)
      : await executeSubmissionBatch(payload, payload.userId)

  console.log(JSON.stringify(result, null, 2))
}

main().catch((error) => {
  console.error((error as Error).stack || (error as Error).message)
  process.exit(1)
})
