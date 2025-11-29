export const PREFAB_ROAD_SLUG = 'prefab'
export const PREFAB_ROAD_NAME = '预制'

export type PrefabPhaseKey = 'ditch' | 'curb' | 'pipe'

export const prefabPhaseOptions: { key: PrefabPhaseKey; name: string; layer: string }[] = [
  { key: 'ditch', name: '边沟', layer: '预制边沟' },
  { key: 'curb', name: '路缘石', layer: '预制路缘石' },
  { key: 'pipe', name: '圆管涵', layer: '预制圆管涵' },
]

export const prefabCheckOptions = ['钢筋绑扎验收', '模版验收', '混凝土浇筑验收']

export const prefabTypeOptions = ['现场验收', '试验验收']
