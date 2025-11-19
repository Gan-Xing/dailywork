import { ReportPreview } from '@/components/report/ReportPreview'
import {
  additionalNarrativeSections,
  equipmentCatalog,
  materialItems,
  observationBlocks,
  personnelGroups,
  weatherConditions,
  weatherPeriods,
  worksExecutedBlocks,
} from '@/lib/reportSchema'
import { createInitialReportState, type DailyReport } from '@/lib/reportState'

const previewReport = createSampleReport()

export default function PrototypePage() {
  return (
    <main className="flex min-h-screen w-full items-start justify-center bg-slate-200 p-4">
      <ReportPreview report={previewReport} locale="fr" />
    </main>
  )
}

function createSampleReport(): DailyReport {
  const draft = createInitialReportState()
  draft.metadata = {
    year: '2025',
    month: '08',
    date: '2025-08-26',
    horaires: '7H à 12H / 13H à 17H',
    stoppageCause: 'Interruption partielle due aux fortes pluies sur le PK42+600 (30 min).',
  }

  weatherPeriods.forEach((period, index) => {
    const condition = weatherConditions[index % weatherConditions.length]
    draft.weather[period] = {
      condition: condition.id,
      rainfall: index === 1 ? '2' : '0',
    }
  })

  equipmentCatalog.forEach((category, categoryIdx) => {
    category.items.forEach((item, itemIdx) => {
      const key = `${category.id}-${item.id}`
      draft.equipment[key] = {
        total: String(Math.max(1, itemIdx % 3) + categoryIdx),
        marche: String(Math.max(0, itemIdx % 2)),
        panne: String(itemIdx % 2 === 0 ? 0 : 1),
        arret: '0',
      }
    })
  })

  materialItems.forEach((item, idx) => {
    draft.materials[item.id] = {
      previous: String(80 * (idx + 1)),
      entry: String(10 * idx),
      exit: String(6 * idx),
      current: String(80 * (idx + 1) + 10 * idx - 6 * idx),
    }
  })

  personnelGroups.forEach((group, groupIdx) => {
    group.roles.forEach((role, roleIdx) => {
      const key = `${group.id}-${role.id}`
      draft.personnel[key] = {
        present: String(2 + ((groupIdx + roleIdx) % 4)),
        absent: String((roleIdx % 3 === 0 ? 1 : 0)),
      }
    })
  })

  draft.expatriate = { present: '5', absent: '0' }

  observationBlocks.forEach((block, idx) => {
    draft.observations[block.id] = {
      fr: `Résumé ${idx + 1} des observations terrain, incluant les points critiques relevés.`,
      zh: `现场观察第 ${idx + 1} 条，包含关键提醒。`,
    }
  })

  worksExecutedBlocks.forEach((block, idx) => {
    draft.works[block.id] = {
      fr: `Travaux ${block.label.fr.toLowerCase()} : progression à ${(idx + 1) * 10}%.`,
      zh: `${block.label.zh}：完成度 ${(idx + 1) * 10}%`,
    }
  })

  additionalNarrativeSections.forEach((section, idx) => {
    draft.additional[section.id] = {
      fr: `Note ${idx + 1} pour ${section.label.fr.toLowerCase()}.`,
      zh: `${section.label.zh} 备注 ${idx + 1}`,
    }
  })

  return draft
}
