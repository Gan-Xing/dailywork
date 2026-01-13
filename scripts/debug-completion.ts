import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const projectId = 1 // TODO: replace with 邦杜库市政路项目 ID
  const targetBoqCode = '401j10'

  const completionBoq = await prisma.boqItem.findFirst({
    where: { projectId, code: targetBoqCode, sheetType: 'ACTUAL' },
  })
  if (!completionBoq) {
    console.error('找不到实际清单行', targetBoqCode)
    process.exit(1)
  }

  const bindings = await prisma.phaseItemBoqItem.findMany({
    where: {
      boqItemId: completionBoq.id,
      isActive: true,
      phaseItem: { isActive: true },
    },
    include: {
      phaseItem: {
        select: { id: true, name: true },
      },
    },
  })

  const phaseItemIds = bindings.map((binding) => binding.phaseItemId)
  const inputs = await prisma.phaseItemInput.findMany({
    where: {
      phaseItemId: { in: phaseItemIds },
      interval: { phase: { road: { projectId } } },
    },
    select: {
      phaseItemId: true,
      intervalId: true,
      manualQuantity: true,
      computedQuantity: true,
      interval: {
        select: {
          startPk: true,
          endPk: true,
          side: true,
          spec: true,
          phase: {
            select: {
              name: true,
              road: { select: { name: true, slug: true } },
            },
          },
        },
      },
    },
  })

  const totals = inputs.reduce<Record<string, number>>((acc, input) => {
    const binding = bindings.find((entry) => entry.phaseItemId === input.phaseItemId)
    const phaseKey = `${input.phaseItemId} · ${binding?.phaseItem.name ?? 'unknown'}`
    const value = Number(input.manualQuantity ?? input.computedQuantity ?? 0)
    if (Number.isFinite(value)) {
      acc[phaseKey] = (acc[phaseKey] ?? 0) + value
    }
    return acc
  }, {})

  console.log('=== 绑定分项完成量 ===')
  for (const [phaseKey, sum] of Object.entries(totals)) {
    console.log(`${phaseKey}: ${sum}`)
  }

  console.log('\n=== 输入明细（intervalId manual computed） ===')
  inputs.forEach((input) => {
    console.log(
      `${input.intervalId} · ${input.interval?.phase?.road?.name ?? 'unknown road'} · ${
        input.interval?.phase?.name ?? 'unknown phase'
      } · ${input.interval?.spec ?? '—'} · PK ${input.interval?.startPk ?? '??'}-${input.interval?.endPk ?? '??'} ${
        input.interval?.side ?? ''
      }  ${
        input.manualQuantity != null ? `manual=${input.manualQuantity}` : 'manual=∅'
      }  ${
        input.computedQuantity != null
          ? `computed=${input.computedQuantity}`
          : 'computed=∅'
      }`,
    )
  })
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
