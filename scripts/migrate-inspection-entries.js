#!/usr/bin/env node
/* eslint-disable no-console */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const DRY_RUN = process.env.DRY_RUN === '1';
const APPLY = process.env.APPLY === '1';
const FORCE = process.env.FORCE === '1';

function pad3(n) {
  return String(n).padStart(3, '0');
}
function toSubCode(n) {
  return `SUB-${pad3(n)}`;
}

async function main() {
  const [subCnt, entryCnt] = await Promise.all([
    prisma.document.count(),
    prisma.inspectionEntry.count(),
  ]);

  if (!FORCE && (subCnt > 0 || entryCnt > 0)) {
    throw new Error(
      `Safety stop: Submission(${subCnt}) / InspectionEntry(${entryCnt}) already has data. ` +
      `TRUNCATE them first or set FORCE=1.`
    );
  }

  const requests = await prisma.inspectionRequest.findMany({
    orderBy: [{ id: 'asc' }],
  });

  let nextAuto = 1;
  const reqToOrder = new Map();
  for (const r of requests) {
    const ord = (r.submissionOrder !== null && r.submissionOrder !== undefined)
      ? Number(r.submissionOrder)
      : (nextAuto++);
    reqToOrder.set(r.id, ord);
  }

  const codes = Array.from(
    new Set(requests.map(r => toSubCode(reqToOrder.get(r.id))))
  ).sort();

  if (DRY_RUN && !APPLY) {
    let entriesToCreate = 0;
    for (const r of requests) {
      const layers = Array.isArray(r.layers) && r.layers.length ? r.layers : ['UNKNOWN_LAYER'];
      const checks = Array.isArray(r.checks) && r.checks.length ? r.checks : ['UNKNOWN_CHECK'];
      entriesToCreate += layers.length * checks.length;
    }
    console.log(`[DRY] processed ${requests.length} requests; entries to create: ${entriesToCreate}; submissions: ${codes.length}`);
    return;
  }

  await prisma.document.createMany({
    data: codes.map(code => ({ code, files: [], remark: null })),
    skipDuplicates: true,
  });

  const subs = await prisma.document.findMany({
    where: { code: { in: codes } },
    select: { id: true, code: true },
  });
  const codeToId = new Map(subs.map(s => [s.code, s.id]));

  if (codeToId.size !== codes.length) {
    const missing = codes.filter(c => !codeToId.has(c));
    throw new Error(`Submission id mapping missing for codes: ${missing.slice(0, 30).join(', ')}${missing.length > 30 ? '...' : ''}`);
  }

  const CHUNK = 500;
  let processed = 0;
  let entriesInserted = 0;

  for (const r of requests) {
    const code = toSubCode(reqToOrder.get(r.id));
    const submissionId = codeToId.get(code);

    if (!submissionId) {
      throw new Error(`No submissionId for request id=${r.id}, code=${code}`);
    }

    const layers = Array.isArray(r.layers) && r.layers.length ? r.layers : ['UNKNOWN_LAYER'];
    const checks = Array.isArray(r.checks) && r.checks.length ? r.checks : ['UNKNOWN_CHECK'];
    const types = Array.isArray(r.types) ? r.types : [];

    const entries = [];
    for (const layerName of layers) {
      for (const checkName of checks) {
        entries.push({
          submissionId,
          roadId: r.roadId,
          phaseId: r.phaseId,
          side: r.side,
          startPk: r.startPk,
          endPk: r.endPk,
          layerId: null,
          layerName: String(layerName),
          checkId: null,
          checkName: String(checkName),
          types,
          status: r.status,
          appointmentDate: r.appointmentDate ?? null,
          remark: r.remark ?? null,
          submissionOrder: r.submissionOrder ?? reqToOrder.get(r.id),
          submittedAt: r.submittedAt ?? new Date(),
          submittedBy: r.submittedBy ?? null,
          createdBy: r.createdBy ?? null,
          updatedBy: r.updatedBy ?? null,
          createdAt: r.createdAt ?? new Date(),
          updatedAt: r.updatedAt ?? new Date(),
        });
      }
    }

    for (let i = 0; i < entries.length; i += CHUNK) {
      const slice = entries.slice(i, i + CHUNK);
      await prisma.inspectionEntry.createMany({ data: slice });
      entriesInserted += slice.length;
    }

    processed += 1;
    if (processed % 20 === 0) {
      console.log(`[APPLY] processed ${processed}/${requests.length}; entries inserted: ${entriesInserted}`);
    }
  }

  console.log(`[DONE] processed ${requests.length} requests; entries inserted: ${entriesInserted}; submissions: ${codes.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
