import {
  additionalNarrativeSections,
  equipmentEntries,
  materialItems,
  observationBlocks,
  personnelRoles,
  type EquipmentEntry,
  weatherConditions,
  weatherPeriods,
  worksExecutedBlocks,
  type AdditionalSectionKey,
  type ObservationKey,
  type WeatherPeriod,
  type WorkBlock,
} from './reportSchema'
import type { Locale } from './i18n'
import equipmentDefaultMap from './data/equipment-defaults.json'

export interface WeatherEntry {
  condition: string
  rainfall: string
}

export interface EquipmentStatus {
  total: string
  marche: string
  panne: string
  arret: string
}

export interface MaterialStock {
  previous: string
  entry: string
  exit: string
  current: string
}

export interface PersonnelCount {
  present: string
  absent: string
}

export type LocalizedRichText = Record<Locale, string>

export type NarrativeMap<T extends string> = Record<T, LocalizedRichText>

export interface DailyReport {
  metadata: {
    year: string
    month: string
    date: string
    horaires: string
    stoppageCause: string
  }
  weather: Record<WeatherPeriod, WeatherEntry>
  equipment: Record<string, EquipmentStatus>
  materials: Record<string, MaterialStock>
  personnel: Record<string, PersonnelCount>
  expatriate: PersonnelCount
  observations: NarrativeMap<ObservationKey>
  works: NarrativeMap<WorkBlock>
  additional: NarrativeMap<AdditionalSectionKey>
}

type EquipmentDefaultRecord = Record<
  EquipmentEntry['id'],
  { total: number; marche: number; panne: number; arret: number }
>

const equipmentDefaults = equipmentDefaultMap as EquipmentDefaultRecord

const createEmptyEquipmentStatus = (): EquipmentStatus => ({
  total: '0',
  marche: '0',
  panne: '0',
  arret: '0',
})

const getDefaultEquipmentStatus = (id: EquipmentEntry['id']): EquipmentStatus => {
  const defaults = equipmentDefaults[id]
  if (!defaults) return createEmptyEquipmentStatus()
  return {
    total: String(defaults.total),
    marche: String(defaults.marche),
    panne: String(defaults.panne),
    arret: String(defaults.arret),
  }
}

const createEmptyMaterialStock = (): MaterialStock => ({
  previous: '',
  entry: '',
  exit: '',
  current: '',
})

const createEmptyPersonnelCount = (): PersonnelCount => ({
  present: '',
  absent: '',
})

const defaultWeatherCondition = weatherConditions[0]?.id ?? ''

const createEmptyNarrative = (): LocalizedRichText => ({
  fr: '',
  zh: '',
})

const createWeatherEntry = (): WeatherEntry => ({
  condition: defaultWeatherCondition,
  rainfall: '0',
})

export const createInitialReportState = (): DailyReport => ({
  metadata: {
    year: '',
    month: '',
    date: '',
    horaires: '7H à 12H / 13H à 17H',
    stoppageCause: '',
  },
  weather: weatherPeriods.reduce(
    (acc, period) => ({ ...acc, [period]: createWeatherEntry() }),
    {} as Record<WeatherPeriod, WeatherEntry>,
  ),
  equipment: equipmentEntries.reduce(
    (acc, entry) => ({ ...acc, [entry.id]: getDefaultEquipmentStatus(entry.id) }),
    {} as Record<string, EquipmentStatus>,
  ),
  materials: materialItems.reduce(
    (acc, item) => ({ ...acc, [item.id]: createEmptyMaterialStock() }),
    {} as Record<string, MaterialStock>,
  ),
  personnel: personnelRoles.reduce(
    (acc, role) => ({ ...acc, [role.id]: createEmptyPersonnelCount() }),
    {} as Record<string, PersonnelCount>,
  ),
  expatriate: createEmptyPersonnelCount(),
  observations: observationBlocks.reduce(
    (acc, block) => ({ ...acc, [block.id]: createEmptyNarrative() }),
    {} as NarrativeMap<ObservationKey>,
  ),
  works: worksExecutedBlocks.reduce(
    (acc, block) => ({ ...acc, [block.id]: createEmptyNarrative() }),
    {} as NarrativeMap<WorkBlock>,
  ),
  additional: additionalNarrativeSections.reduce(
    (acc, block) => ({ ...acc, [block.id]: createEmptyNarrative() }),
    {} as NarrativeMap<AdditionalSectionKey>,
  ),
})
