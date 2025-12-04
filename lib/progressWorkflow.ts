import type { PhaseMeasure } from './progressTypes'

export type WorkflowCheckTemplate = {
  id: string
  name: string
  types: string[]
  notes?: string
}

export type WorkflowLayerTemplate = {
  id: string
  name: string
  stage: number
  dependencies: string[]
  lockStepWith?: string[]
  parallelWith?: string[]
  description?: string
  checks: WorkflowCheckTemplate[]
}

export type WorkflowTemplate = {
  id: string
  phaseName: string
  measure: PhaseMeasure
  description?: string
  sideRule?: string
  defaultTypes: string[]
  layers: WorkflowLayerTemplate[]
}

export type WorkflowBinding = WorkflowTemplate & {
  phaseDefinitionId: number
  isActive?: boolean
  pointHasSides?: boolean
}

export const FIXED_INSPECTION_TYPES = ['现场验收', '测量验收', '试验验收', '其他']
export const defaultWorkflowTypes = FIXED_INSPECTION_TYPES

const withAllTypes = (types?: string[]) => (types && types.length ? types : defaultWorkflowTypes)

const simpleLayer = (
  id: string,
  name: string,
  stage: number,
  checks: string[],
  deps: string[] = [],
): WorkflowLayerTemplate => ({
  id,
  name,
  stage,
  dependencies: deps,
  checks: checks.map((checkId, idx) => ({
    id: `${id}-check-${idx + 1}`,
    name: checkId,
    types: defaultWorkflowTypes,
  })),
})

export const culvertWorkflow: WorkflowTemplate = {
  id: 'culvert',
  phaseName: '涵洞',
  measure: 'POINT',
  description:
    '涵洞分项的层次/验收内容/验收类型绑定，按照基坑→垫层→底板/截水墙→墙身/八字墙/顶板/帽石的顺序设置依赖，避免越级报检。',
  sideRule: '可左右分开或同时报检，需遵守前置工序与并行锁定规则。',
  defaultTypes: defaultWorkflowTypes,
  layers: [
    {
      id: 'excavation',
      name: '基坑',
      stage: 1,
      dependencies: [],
      lockStepWith: [],
      parallelWith: [],
      checks: [
        {
          id: 'staking',
          name: '放样与开挖',
          types: ['现场验收', '测量验收'],
          notes: '未完成不得进入垫层或后续任何报检。',
        },
      ],
    },
    {
      id: 'cushion',
      name: '垫层',
      stage: 2,
      dependencies: ['excavation'],
      lockStepWith: [],
      parallelWith: [],
      checks: [
        {
          id: 'lean-pour',
          name: '混凝土浇筑验收',
          types: ['现场验收', '试验验收'],
          notes: '完成后才能创建底板/截水墙的报检单。',
        },
      ],
    },
    {
      id: 'base-slab',
      name: '底板',
      stage: 3,
      dependencies: ['cushion'],
      lockStepWith: ['cutoff'],
      parallelWith: ['cutoff'],
      checks: [
        { id: 'base-rebar', name: '钢筋验收', types: ['现场验收', '测量验收'] },
        { id: 'base-form', name: '模板安装验收', types: ['现场验收'] },
        { id: 'base-pour', name: '混凝土浇筑验收', types: ['现场验收', '试验验收'] },
      ],
    },
    {
      id: 'cutoff',
      name: '截水墙',
      stage: 3,
      dependencies: ['cushion'],
      lockStepWith: ['base-slab'],
      parallelWith: ['base-slab'],
      checks: [
        { id: 'cutoff-rebar', name: '钢筋验收', types: ['现场验收', '测量验收'] },
        { id: 'cutoff-form', name: '模板安装验收', types: ['现场验收'] },
        { id: 'cutoff-pour', name: '混凝土浇筑验收', types: ['现场验收', '试验验收'] },
      ],
    },
    {
      id: 'wall',
      name: '墙身',
      stage: 4,
      dependencies: ['base-slab', 'cutoff'],
      lockStepWith: ['wing', 'roof', 'cap'],
      parallelWith: ['wing', 'roof', 'cap'],
      checks: [
        { id: 'wall-rebar', name: '钢筋验收', types: ['现场验收', '测量验收'] },
        { id: 'wall-form', name: '模板安装验收', types: ['现场验收'] },
        { id: 'wall-pour', name: '混凝土浇筑验收', types: ['现场验收', '试验验收'] },
      ],
    },
    {
      id: 'wing',
      name: '八字墙',
      stage: 4,
      dependencies: ['base-slab', 'cutoff'],
      lockStepWith: ['wall', 'roof', 'cap'],
      parallelWith: ['wall', 'roof', 'cap'],
      checks: [
        { id: 'wing-rebar', name: '钢筋验收', types: ['现场验收', '测量验收'] },
        { id: 'wing-form', name: '模板安装验收', types: ['现场验收'] },
        { id: 'wing-pour', name: '混凝土浇筑验收', types: ['现场验收', '试验验收'] },
      ],
    },
    {
      id: 'roof',
      name: '顶板',
      stage: 4,
      dependencies: ['base-slab', 'cutoff'],
      lockStepWith: ['cap', 'wall', 'wing'],
      parallelWith: ['cap', 'wall', 'wing'],
      description: '顶板与帽石应成组报检，避免单独浇筑。',
      checks: [
        { id: 'roof-rebar', name: '钢筋验收', types: ['现场验收', '测量验收'] },
        { id: 'roof-form', name: '模板安装验收', types: ['现场验收'] },
        { id: 'roof-pour', name: '混凝土浇筑验收', types: ['现场验收', '试验验收'] },
      ],
    },
    {
      id: 'cap',
      name: '帽石',
      stage: 4,
      dependencies: ['base-slab', 'cutoff'],
      lockStepWith: ['roof', 'wall', 'wing'],
      parallelWith: ['roof', 'wall', 'wing'],
      description: '与顶板同节奏验收钢筋/模板/浇筑。',
      checks: [
        { id: 'cap-rebar', name: '钢筋验收', types: ['现场验收', '测量验收'] },
        { id: 'cap-form', name: '模板安装验收', types: ['现场验收'] },
        { id: 'cap-pour', name: '混凝土浇筑验收', types: ['现场验收', '试验验收'] },
      ],
    },
    {
      id: 'finishing-plaster',
      name: '埋墙粉刷',
      stage: 5,
      dependencies: ['wall', 'wing', 'roof', 'cap'],
      lockStepWith: [],
      parallelWith: [],
      description:
        '终验环节，需在放样/开挖、钢筋、模板、混凝土浇筑全部完成后进行，可选择需粉刷的子构件范围。',
      checks: [
        {
          id: 'finishing-plaster-check',
          name: '埋墙粉刷验收',
          types: ['现场验收', '试验验收'],
          notes: '适用于整体收口或局部粉刷，前提是所有前序层次的四类验收内容已完成。',
        },
      ],
    },
  ],
}

export const earthworkWorkflow: WorkflowTemplate = {
  id: 'earthwork',
  phaseName: '土方',
  measure: 'LINEAR',
  description: '按填土层次逐级验收，确保压实到位后再进入下一层。',
  defaultTypes: defaultWorkflowTypes,
  layers: [
    simpleLayer('fill-1', '第一层填土', 1, ['压实度验收']),
    simpleLayer('fill-2', '第二层填土', 2, ['压实度验收'], ['fill-1']),
    simpleLayer('fill-3', '第三层填土', 3, ['压实度验收'], ['fill-2']),
    simpleLayer('fill-4', '第四层填土', 4, ['压实度验收'], ['fill-3']),
  ],
}

export const subbaseWorkflow: WorkflowTemplate = {
  id: 'subbase',
  phaseName: '垫层',
  measure: 'LINEAR',
  description: '路基垫层整体验收，含压实度、标高与弯沉/CBR 检测。',
  defaultTypes: defaultWorkflowTypes,
  layers: [
    {
      id: 'subbase',
      name: '路基垫层',
      stage: 1,
      dependencies: [],
      checks: [
        { id: 'subbase-compaction', name: '压实度验收', types: defaultWorkflowTypes },
        { id: 'subbase-elevation', name: '标高验收', types: defaultWorkflowTypes },
        { id: 'subbase-cbr', name: 'CBR', types: defaultWorkflowTypes },
        { id: 'subbase-deflection', name: '弯沉验收', types: defaultWorkflowTypes },
      ],
    },
  ],
}

export const baseCourseWorkflow: WorkflowTemplate = {
  id: 'base-course',
  phaseName: '底基层',
  measure: 'LINEAR',
  description: '底基层整体验收，含压实度、标高与弯沉/CBR 检测。',
  defaultTypes: defaultWorkflowTypes,
  layers: [
    {
      id: 'base-course',
      name: '底基层',
      stage: 1,
      dependencies: [],
      checks: [
        { id: 'base-course-compaction', name: '压实度验收', types: defaultWorkflowTypes },
        { id: 'base-course-elevation', name: '标高验收', types: defaultWorkflowTypes },
        { id: 'base-course-cbr', name: 'CBR', types: defaultWorkflowTypes },
        { id: 'base-course-deflection', name: '弯沉验收', types: defaultWorkflowTypes },
      ],
    },
  ],
}

export const walkwayCulvertWorkflow: WorkflowTemplate = {
  id: 'walkway-culvert',
  phaseName: '过道涵',
  measure: 'POINT',
  description: '简化的涵洞流程：基坑→底板→墙身→顶板，按顺序报检。',
  defaultTypes: defaultWorkflowTypes,
  layers: [
    simpleLayer('excavation', '基坑', 1, ['放样与开挖']),
    simpleLayer('base-slab', '底板', 2, ['钢筋绑扎验收', '模版安装验收', '混凝土浇筑验收'], ['excavation']),
    simpleLayer('wall', '墙身', 3, ['钢筋绑扎验收', '模版安装验收', '混凝土浇筑验收'], ['base-slab']),
    simpleLayer('roof', '顶板', 4, ['钢筋绑扎验收', '模版安装验收', '混凝土浇筑验收'], ['wall']),
  ],
}

export const sideDitchWorkflow: WorkflowTemplate = {
  id: 'side-ditch',
  phaseName: '边沟',
  measure: 'LINEAR',
  description: '基坑验收后进行边沟安装，可并行左/右侧施工。',
  defaultTypes: defaultWorkflowTypes,
  layers: [
    simpleLayer('excavation', '基坑', 1, ['放样与开挖']),
    simpleLayer('ditch', '边沟', 2, ['安装验收'], ['excavation']),
  ],
}

export const pipeCulvertWorkflow: WorkflowTemplate = {
  id: 'pipe-culvert',
  phaseName: '圆管涵',
  measure: 'LINEAR',
  description: '基坑完成后安装圆管涵，按顺序报检。',
  defaultTypes: defaultWorkflowTypes,
  layers: [
    simpleLayer('excavation', '基坑', 1, ['放样与开挖']),
    simpleLayer('pipe', '圆管涵', 2, ['安装验收'], ['excavation']),
  ],
}

export const curbWorkflow: WorkflowTemplate = {
  id: 'curb',
  phaseName: '路缘石',
  measure: 'LINEAR',
  description: '路缘石安装验收单层流程。',
  defaultTypes: defaultWorkflowTypes,
  layers: [simpleLayer('curb', '路缘石', 1, ['安装验收'])],
}

export const slabCoverWorkflow: WorkflowTemplate = {
  id: 'slab-cover',
  phaseName: '盖板',
  measure: 'LINEAR',
  description: '盖板安装单层流程。',
  defaultTypes: defaultWorkflowTypes,
  layers: [simpleLayer('cover', '盖板', 1, ['安装验收'])],
}

export const oldCulvertRemovalWorkflow: WorkflowTemplate = {
  id: 'old-culvert-removal',
  phaseName: '旧涵挖除',
  measure: 'POINT',
  description: '原有涵洞拆除清理后验收，单层流程。',
  defaultTypes: defaultWorkflowTypes,
  layers: [simpleLayer('removal', '原有涵洞', 1, ['尺寸及清理验收'])],
}

export const oldDitchRemovalWorkflow: WorkflowTemplate = {
  id: 'old-ditch-removal',
  phaseName: '旧边沟挖除',
  measure: 'LINEAR',
  description: '原有边沟拆除清理后验收，单层流程。',
  defaultTypes: defaultWorkflowTypes,
  layers: [simpleLayer('removal', '原有边沟', 1, ['起终点桩号及清理完成验收'])],
}

export const defaultWorkflowTemplates: WorkflowTemplate[] = [
  culvertWorkflow,
  earthworkWorkflow,
  subbaseWorkflow,
  baseCourseWorkflow,
  walkwayCulvertWorkflow,
  sideDitchWorkflow,
  pipeCulvertWorkflow,
  curbWorkflow,
  slabCoverWorkflow,
  oldCulvertRemovalWorkflow,
  oldDitchRemovalWorkflow,
]
