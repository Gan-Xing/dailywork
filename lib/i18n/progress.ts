import type { Locale } from './index'
import { FIXED_INSPECTION_TYPES } from '../progressWorkflow'

const formatCopy = (template: string, values: Record<string, string | number>): string =>
  template.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? ''))

type ProgressCopy = {
  hero: {
    badge: string
    title: string
    description: string
    home: string
    reports: string
    loadError: string
  }
  nav: {
    home: string
    progress: string
    inspections: string
  }
  access: {
    progressViewHint: string
    progressDetailHint: string
    inspectionViewHint: string
  }
  admin: {
    badge: string
    title: string
    description: string
    editMode: string
    saving: string
  }
  form: {
    slugLabel: string
    slugPlaceholder: string
    slugTitle: string
    nameLabel: string
    namePlaceholder: string
    startLabel: string
    startPlaceholder: string
    endLabel: string
    endPlaceholder: string
    exitEdit: string
  }
  actions: {
    add: string
    save: string
    reset: string
    cancel: string
    close: string
  }
  errors: {
    noPermission: string
    saveFailed: string
    saveMissing: string
    deleteFailed: string
    loadFailed: string
  }
  list: {
    overview: string
    none: string
    count: string
    emptyHelp: string
  }
  card: {
    label: string
    start: string
    end: string
    slug: string
    edit: string
    delete: string
    workNote: string
    updated: string
  }
  detail: {
    badge: string
    slugLine: string
    back: string
    notFoundTitle: string
    notFoundBody: string
    backToBoard: string
    breadcrumbProgress: string
  }
  phase: PhaseCopy
  workflow: WorkflowCopy
  inspectionBoard: InspectionBoardCopy
}

type WorkflowCopy = {
  badge: string
  title: string
  description: string
  localHint: string
  accessHint: string
  actions: {
    save: string
    reset: string
    addLayer: string
    deleteLayer: string
    addCheck: string
    deleteCheck: string
    createTemplate: string
    deleteTemplate: string
  }
  templateBadge: string
  templateTitle: string
  templateHint: string
  templateNote: string
  templateEmpty: string
  templateNameLabel: string
  templateNamePlaceholder: string
  templateDescriptionLabel: string
  templateDescriptionPlaceholder: string
  templateSideRuleLabel: string
  templateSideRulePlaceholder: string
  bindingLayers: string
  bindingChecks: string
  measureLabel: string
  measureLinear: string
  measurePoint: string
  pointHasSidesLabel: string
  newTemplateBadge: string
  newTemplateTitle: string
  newTemplateHint: string
  newTemplatePlaceholder: string
  templateCreated: string
  deleted: string
  deleteFailed: string
  errors: {
    templateNameRequired: string
  }
  ruleBadge: string
  ruleTitle: string
  ruleHint: string
  quick: {
    layerTitle: string
    layerHint: string
    deletePlaceholder: string
    checkPlaceholder: string
  }
  layerNote: string
  stageLabel: string
  dependsLabel: string
  lockLabel: string
  parallelLabel: string
  checkTitle: string
  checkNote: string
  newLayer: string
  newCheck: string
  noPeers: string
  timelineBadge: string
  timelineTitle: string
  timelineHint: string
  legend: {
    locked: string
    parallel: string
    types: string
  }
  stageName: string
  stageHint: string
  stageCountPrefix: string
  timelineDepends: string
  timelineFree: string
  lockedWith: string
  parallelWith: string
  summaryTitle: string
  summaryHint: string
  summaryEmpty: string
  ruleDepends: string
  ruleLock: string
  saved: string
  reset: string
  empty: string
  saveFailed: string
  saving: string
}

type PhaseCopy = {
  title: string
  roadLengthLabel: string
  roadLengthUnknown: string
  addButton: string
  manageTip: string
  viewOnlyTip: string
  form: {
    editingBadge: string
    creatingBadge: string
    resetEdit: string
    resetNew: string
    designSummary: string
    templateLabel: string
    templateCustom: string
    nameLabel: string
    namePlaceholder: string
    measureLabel: string
    measureOptionLinear: string
    measureOptionPoint: string
    pointSidesLabel: string
    pointSidesHint: string
    designHintPrefix: string
    designHintPoint: string
    designHintLinear: string
    intervalTitle: string
    intervalAdd: string
    intervalStart: string
    intervalEnd: string
    intervalSide: string
    intervalSpec: string
    intervalBillQuantity: string
    sideBoth: string
    sideLeft: string
    sideRight: string
    intervalDelete: string
    layersTitle: string
    layersAdd: string
    layersPlaceholder: string
    layersEmpty: string
    checksTitle: string
    checksAdd: string
    checksPlaceholder: string
    checksEmpty: string
    save: string
    saving: string
  }
  note: {
    measure: string
  }
  view: {
    label: string
    road: string
    phase: string
  }
  aggregate: {
    empty: string
    roadsLabel: string
    linearSummary: string
    pointSummary: string
    moreUnits: string
    updatedLabel: string
  }
  list: {
    title: string
    legend: string
    legendNote: string
    empty: string
    emptyHint: string
  }
  card: {
    measurePoint: string
    measureLinear: string
    completed: string
    edit: string
    delete: string
    deleting: string
  }
  delete: {
    title: string
    confirmPrompt: string
    impactTitle: string
    impactList: string[]
    cancel: string
    confirmLabel: string
    confirming: string
    close: string
  }
  status: {
    pending: string
    scheduled: string
    submitted: string
    inProgress: string
    approved: string
    nonDesign: string
  }
  errors: {
    invalidRange: string
    definitionMissing: string
    saveFailed: string
    deleteFailed: string
    submitRangeInvalid: string
    submitLayerMissing: string
    submitCheckMissing: string
    submitTypeMissing: string
    submitAppointmentMissing: string
    submitFailed: string
  }
  success: {
    created: string
    updated: string
  }
  inspection: {
    title: string
    sideLabel: string
    sideBoth: string
    sideLeft: string
    sideRight: string
    startLabel: string
    startPlaceholder: string
    endLabel: string
    endPlaceholder: string
    appointmentLabel: string
    appointmentPlaceholder: string
    layersLabel: string
    layersEmpty: string
    checksLabel: string
    checksEmpty: string
    checkPlaceholder: string
    typesLabel: string
    typesHint: string
    remarkLabel: string
    remarkPlaceholder: string
    cancel: string
    submit: string
    submitting: string
    permissionMissing: string
    dialogTitle: string
    dialogClose: string
    dialogBundleMessage: string
    dialogBundleConfirm: string
    dialogCancel: string
    submitSuccess: string
    missingDeps: string
    missingChecks: string
    types: string[]
  }
  alerts: {
    noInspectPermission: string
    fetchInspectionFailed: string
  }
  pointBadge: {
    none: string
  }
  units: {
    point: string
    linear: string
  }
}

type InspectionBoardCopy = {
  badge: string
  title: string
  description: string
  breadcrumb: {
    home: string
    progress: string
    current: string
  }
  prefabRoadName: string
  errorHint: string
  filters: {
    road: string
    all: string
    phase: string
    side: string
    sideLeft: string
    sideRight: string
    sideBoth: string
    type: string
    typePlaceholder: string
    check: string
    checkPlaceholder: string
    status: string
    startPkFrom: string
    startPkTo: string
    startDate: string
    endDate: string
    keyword: string
    keywordPlaceholder: string
    reset: string
    search: string
    addPrefab: string
    loading: string
  }
  typePicker: {
    placeholder: string
    selected: string
    summary: string
    selectAll: string
    clear: string
    all: string
  }
  status: Record<string, string>
  columns: {
    sequence: string
    road: string
    phase: string
    side: string
    range: string
    layers: string
    checks: string
    types: string
    submissionOrder: string
    status: string
    appointmentDate: string
    submittedAt: string
    submittedBy: string
    remark: string
    createdBy: string
    createdAt: string
    updatedBy: string
    updatedAt: string
    actions: string
  }
  columnSelector: {
    selectedCount: string
    noneSelected: string
    selectAll: string
    restore: string
    clear: string
  }
  pdf: {
    export: string
    preview: string
    exporting: string
    previewing: string
    failed: string
  }
  bulk: {
    selectedCount: string
    missingSelection: string
    delete: string
    edit: string
  }
  bulkDelete: {
    badge: string
    title: string
    hint: string
    cancel: string
    confirm: string
    confirming: string
  }
  bulkEdit: {
    badge: string
    title: string
    hint: string
    noChange: string
    noChangeHint: string
    rangeHint: string
    tokenHint: string
    remarkHint: string
    invalidRange: string
    invalidSubmittedAt: string
    invalidSubmissionOrder: string
    missingFields: string
    save: string
    saving: string
    cancel: string
    closeAria: string
  }
  table: {
    add: string
    loading: string
    empty: string
    selectPage: string
    selectRow: string
    view: string
    edit: string
    delete: string
  }
  pagination: {
    summary: string
    prev: string
    next: string
    goTo: string
  }
  prefabModal: {
    badge: string
    title: string
    subtitle: string
    closeAria: string
    phaseLabel: string
    phaseOptions: Record<string, string>
    layerOptions: Record<string, string>
    checkOptions: Record<string, string>
    typeOptions: Record<string, string>
    appointmentLabel: string
    layersLabel: string
    typesLabel: string
    checksLabel: string
    remarkLabel: string
    remarkPlaceholder: string
    cancel: string
    submit: string
    submitting: string
  }
  detailModal: {
    badge: string
    closeAria: string
    contentsLabel: string
    typesLabel: string
    statusLabel: string
    submittedAt: string
    updatedAt: string
    submittedBy: string
    remarkLabel: string
    remarkEmpty: string
    unknownUser: string
  }
  editModal: {
    badge: string
    closeAria: string
    phaseLabel: string
    phasePlaceholder: string
    sideLabel: string
    sidePlaceholder: string
    sideLeft: string
    sideRight: string
    sideBoth: string
    sidePrefabNote: string
    rangeLabel: string
    rangePrefabNote: string
    startLabel: string
    endLabel: string
    layersLabel: string
    layersPlaceholder: string
    checksLabel: string
    checksPlaceholder: string
    typesLabel: string
    typesPlaceholder: string
    appointmentLabel: string
    submittedAtLabel: string
    statusLabel: string
    statusPlaceholder: string
    submissionOrderLabel: string
    submissionOrderPlaceholder: string
    remarkLabel: string
    remarkPlaceholder: string
    cancel: string
    save: string
    saving: string
    invalidRange: string
    missingPhase: string
    missingRequired: string
    appointmentMissing: string
    invalidSubmissionOrder: string
    saveFailed: string
  }
  deleteModal: {
    badge: string
    closeAria: string
    confirmText: string
    cancel: string
    confirm: string
    confirming: string
    failed: string
  }
  errors: {
    loadFailed: string
    createFailed: string
    updateFailed: string
    deleteFailed: string
    bulkDeleteFailed: string
    bulkFailed: string
    exportFailed: string
  }
}

const progressCopy: Record<Locale, ProgressCopy> = {
  zh: {
    hero: {
      badge: '进度',
      title: '道路进度看板',
      description:
        '路段由管理员统一创建（名称 + 起点 + 终点），后续分项工程、报检与验收都会挂载在这些路段之下。当前页面先完成路段的增删改维护。',
      home: '返回首页',
      reports: '去填写日报',
      loadError: '加载路段列表失败：{message}。仍可尝试直接新增，保存后会刷新列表。',
    },
    nav: {
      home: '首页',
      progress: '进度管理',
      inspections: '报检记录',
    },
    access: {
      progressViewHint: '开通查看权限后可使用甘特与里程碑视图。',
      progressDetailHint: '开通查看权限后可使用甘特、风险与节点详情。',
      inspectionViewHint: '需要查看报检权限才能浏览此列表。',
    },
    admin: {
      badge: 'Admin',
      title: '路段管理',
      description: '仅管理员可维护路段清单，分项工程稍后在详情内补充。',
      editMode: '编辑模式 · ID {id}',
      saving: '正在保存...',
    },
    form: {
      slugLabel: '路由',
      slugPlaceholder: '如：bondoukou-university',
      slugTitle: '仅允许小写字母、数字和连字符',
      nameLabel: '名称',
      namePlaceholder: '如：大学城路',
      startLabel: '起点',
      startPlaceholder: '例：PK0+000 / 交叉口 A',
      endLabel: '终点',
      endPlaceholder: '例：PK1+940 / 桥头',
      exitEdit: '退出编辑',
    },
    actions: {
      add: '添加路段',
      save: '保存修改',
      reset: '重置表单',
      cancel: '取消',
      close: '关闭',
    },
    errors: {
      noPermission: '暂无路段管理权限',
      saveFailed: '保存失败，请重试',
      saveMissing: '保存成功，但未收到返回数据',
      deleteFailed: '删除失败，请重试',
      loadFailed: '无法加载路段，请返回列表。',
    },
    list: {
      overview: '路段总览',
      none: '尚未添加',
      count: '共 {count} 条',
      emptyHelp: '暂无路段，先在上方填写“名称 + 起点 + 终点”添加第一条。',
    },
    card: {
      label: '路段',
      start: '起点',
      end: '终点',
      slug: '路由',
      edit: '编辑',
      delete: '删除',
      workNote:
        '分项工程：待进入路段详情后配置。当前仅管理员维护路段范围，后续验收数据会自动驱动进度色带。',
      updated: '最近更新：',
    },
    detail: {
      badge: '路段详情',
      slugLine: '路由：{slug} · 起点：{start} · 终点：{end}',
      back: '返回列表',
      notFoundTitle: '路段不存在',
      notFoundBody: '未找到对应路段，请返回列表。',
      backToBoard: '返回进度看板',
      breadcrumbProgress: '进度管理',
    },
    phase: {
      title: '分项工程',
      roadLengthLabel: '道路长度（估算）：{length} m',
      roadLengthUnknown: '未填写',
      addButton: '新增分项',
      manageTip: '新增/编辑分项会在弹窗中完成，便于手机端查看。',
      viewOnlyTip: '当前账号缺少编辑权限，仅可查看已有分项。',
      form: {
        editingBadge: '编辑分项 · ID {id}',
        creatingBadge: '新增分项',
        resetEdit: '退出编辑',
        resetNew: '重置表单',
        designSummary: '道路长度（估算）：{length} m · 设计量自动计算：{design}',
        templateLabel: '分项模板',
        templateCustom: '自定义/新建',
        nameLabel: '名称',
        namePlaceholder: '如：土方',
        measureLabel: '显示方式',
        measureOptionLinear: '延米（按起终点展示进度）',
        measureOptionPoint: '单体（按点位/条目展示）',
        pointSidesLabel: '单体按左右侧展示',
        pointSidesHint: '适用于左右侧分别报检的单体；默认单行展示。',
        designHintPrefix: '设计量自动计算：',
        designHintPoint: '{design} 个（按条目数）',
        designHintLinear: '{design} m（双侧区间按左右叠加）',
        intervalTitle: '起点-终点列表（起点=终点可表示一个点）',
        intervalAdd: '添加区间',
        intervalStart: '起点',
        intervalEnd: '终点',
        intervalSide: '侧别',
        intervalSpec: '规格',
        intervalBillQuantity: '计量工程量',
        sideBoth: '双侧',
        sideLeft: '左侧',
        sideRight: '右侧',
        intervalDelete: '删除',
        layersTitle: '层次（当前分项使用的候选）',
        layersAdd: '添加',
        layersPlaceholder: '选择或新增层次，如：第一层上土',
        layersEmpty: '暂无已选层次，输入后点击添加，或从上方候选中选择。',
        checksTitle: '验收内容（当前分项使用的候选）',
        checksAdd: '添加',
        checksPlaceholder: '如：压实度/平整度',
        checksEmpty: '暂无已选验收内容，输入后点击添加，或从上方候选中选择。',
        save: '保存分项',
        saving: '正在保存...',
      },
      note: {
        measure: '说明：显示方式决定进度展示形态；设计量自动按区间或单体数量统计，延米类双侧会叠加左右长度。',
      },
      view: {
        label: '查看方式',
        road: '按路段',
        phase: '按分项工程',
      },
      aggregate: {
        empty: '暂无分项工程数据',
        roadsLabel: '涵盖路段：{roads}',
        linearSummary: '延米 · 设计量 {design} m · 已验收 {completed} m · 完成 {percent}%',
        pointSummary: '单体 · 总数 {design} 个 · 已完成 {completed} 个 · 完成 {percent}%',
        moreUnits: '+{count} 个更多',
        updatedLabel: '更新：',
      },
      list: {
        title: '已有分项',
        legend: '已有分项（白色=未验收，可点击预约报检）',
        legendNote: '灰=非设计 白=未验收',
        empty: '暂无分项，添加后将显示在此处。',
        emptyHint: '尚未添加分项工程，点击进入详情新增。',
      },
      card: {
        measurePoint: '单体 · 设计量 {value} 个',
        measureLinear: '延米 · 设计量 {value} m',
        completed: '已完成 {percent}%',
        edit: '编辑分项',
        delete: '删除分项',
        deleting: '删除中...',
      },
      delete: {
        title: '删除分项',
        confirmPrompt: '确定删除「{name}」？',
        impactTitle: '删除后会产生以下影响：',
        impactList: [
          '• 关联的区间与报检记录一并移除，无法恢复。',
          '• 仅影响当前分项，不改动其他分项。',
          '• 请确认已导出或备份必要数据。',
        ],
        cancel: '取消',
        confirmLabel: '确认删除',
        confirming: '正在删除...',
        close: '关闭删除确认',
      },
      status: {
        pending: '待处理',
        scheduled: '已预约',
        submitted: '已报检',
        inProgress: '验收中',
        approved: '已验收',
        nonDesign: '非设计',
      },
      errors: {
        invalidRange: '请填写有效的起点/终点',
        saveFailed: '保存失败',
        deleteFailed: '删除失败',
      submitRangeInvalid: '请输入有效的起点和终点',
      submitLayerMissing: '请选择至少一个层次',
      submitCheckMissing: '请选择至少一个验收内容',
      submitTypeMissing: '请选择至少一个验收类型',
      submitAppointmentMissing: '请选择预约日期',
      submitFailed: '提交失败',
      definitionMissing: '请选择分项模板',
    },
    success: {
      created: '分项「{name}」已创建',
      updated: '分项「{name}」已更新',
    },
      inspection: {
        title: '预约报检',
        sideLabel: '侧别',
        sideBoth: '双侧',
        sideLeft: '左侧',
        sideRight: '右侧',
        startLabel: '起点',
        startPlaceholder: '输入起点 PK',
        endLabel: '终点',
        endPlaceholder: '输入终点 PK',
        appointmentLabel: '预约报检日期',
        appointmentPlaceholder: '选择日期',
        layersLabel: '层次（多选）',
        layersEmpty: '暂无层次，请先在分项维护中添加。',
        checksLabel: '验收内容（多选，可临时添加）',
        checksEmpty: '暂无验收内容，请在分项维护中添加或临时新增。',
        checkPlaceholder: '临时新增验收内容',
        typesLabel: '验收类型（多选）',
        typesHint: '提示：若区间与侧别与上方段落一致，可直接提交；否则请修改起讫点或侧别。',
        remarkLabel: '备注（多行）',
        remarkPlaceholder: '可填写施工说明、注意事项等',
        cancel: '取消',
        submit: '提交报检',
        submitting: '提交中...',
        permissionMissing: '缺少报检权限',
        dialogTitle: '提交提醒',
        dialogClose: '知道了',
        dialogBundleMessage: '本次报检包含尚未完成的前置层次：{deps}。确认合并预约并一并报检吗？',
        dialogBundleConfirm: '确认一起报检',
        dialogCancel: '返回修改',
        submitSuccess: '报检已提交成功，可在报检记录查看进度。',
        missingDeps: '缺少前置报检/预约：{deps}',
        missingChecks: '缺少前置验收内容：{checks}',
        types: FIXED_INSPECTION_TYPES,
      },
      alerts: {
        noInspectPermission: '缺少报检权限',
        fetchInspectionFailed: '拉取报检记录失败',
      },
      pointBadge: {
        none: '未报检',
      },
      units: {
        point: '个',
        linear: 'm',
      },
    },
    workflow: {
      badge: '分项模板',
      title: '分项模板管理',
      description: '集中维护分项模板、层次、验收内容及依赖关系，支持新增/删除模板并同步报检校验。',
      localHint: '规则保存到后端数据库，默认已为常用分项创建模板；保存后即用于校验逻辑（后续报检校验会接入）。',
      accessHint: '需要道路管理权限才能维护验收关系。',
      actions: {
        save: '保存模板',
        reset: '恢复默认',
        addLayer: '新增层次',
        deleteLayer: '删除层次',
        addCheck: '新增验收内容',
        deleteCheck: '删除验收内容',
        createTemplate: '新增模板',
        deleteTemplate: '删除模板',
      },
      templateBadge: '模板',
      templateTitle: '选择分项模板',
      templateHint: '每个分项维护一套层次-验收内容-验收类型的绑定关系。',
      templateNote: '提示：关系会用于校验报检顺序与可选项，后续可接入接口生效到实际报检流程。',
      templateEmpty: '暂无模板，请先创建一个分项模板。',
      templateNameLabel: '模板名称',
      templateNamePlaceholder: '输入模板名称',
      templateDescriptionLabel: '模板说明',
      templateDescriptionPlaceholder: '描述模板适用范围、施工要点或注意事项',
      templateSideRuleLabel: '报检侧别规则',
      templateSideRulePlaceholder: '如：单体左右侧可分开报检或必须同步',
      measureLabel: '显示方式',
      measureLinear: '延米',
      measurePoint: '单体',
      pointHasSidesLabel: '单体分左右侧展示',
      newTemplateBadge: '新增模板',
      newTemplateTitle: '创建新的分项模板',
      newTemplateHint: '填写名称与显示方式即可创建，后续可在右侧补充层次与验收内容。',
      newTemplatePlaceholder: '如：边沟、路缘石、挡土墙',
      templateCreated: '模板已创建，可继续编辑层次/验收内容。',
      deleted: '模板已删除或已停用。',
      deleteFailed: '删除模板失败',
      errors: {
        templateNameRequired: '模板名称不能为空',
      },
      bindingLayers: '层次：{count} 个',
      bindingChecks: '验收内容：{count} 条',
      ruleBadge: '规则编辑',
      ruleTitle: '层次依赖与报检限制',
      ruleHint: '设置前置关系、必须同步的层次，以及允许并行的组合，并按顺序维护验收内容与类型绑定。',
      quick: {
        layerTitle: '层次快速操作',
        layerHint: '填写名称和阶段号即可新增层次，删除时自动清理依赖。',
        deletePlaceholder: '选择要删除的层次',
        checkPlaceholder: '输入验收内容名称',
      },
      layerNote: '可填写层次说明、施工要点或限制。',
      stageLabel: '阶段序号',
      dependsLabel: '前置层次（完成后才能预约）',
      lockLabel: '锁定并行（必须一起报检）',
      parallelLabel: '允许并行（可同批预约）',
      checkTitle: '验收内容顺序',
      checkNote: '备注：如同一批次浇筑、留置试件要求等。',
      newLayer: '新层次',
      newCheck: '新增验收内容',
      noPeers: '暂无可关联的层次',
      timelineBadge: '可视化',
      timelineTitle: '{phase} · 流程视图',
      timelineHint: '按阶段分列展示前置关系、锁定并行与验收类型绑定，便于现场沟通。',
      legend: {
        locked: '必须锁定一起',
        parallel: '可并行',
        types: '验收类型',
      },
      stageName: '阶段 {value}',
      stageHint: '必须完成上一阶段后才能进入此阶段',
      stageCountPrefix: '层次数',
      timelineDepends: '前置：{deps}',
      timelineFree: '无前置，可直接预约',
      lockedWith: '锁定：{peers}',
      parallelWith: '可并行：{peers}',
      summaryTitle: '规则摘要',
      summaryHint: '快速核对：哪些层次是前置，哪些必须同步，验收内容顺序及类型绑定。',
      summaryEmpty: '尚未设置依赖或锁定关系。',
      ruleDepends: '{name} 依赖 {deps}',
      ruleLock: '{name} 必须与 {peers} 同步验收',
      saved: '已保存到后端，可继续调整或刷新查看。',
      reset: '已恢复为默认模板（未自动保存）。',
      empty: '暂无可用模板',
      saveFailed: '保存失败，请稍后重试',
      saving: '保存中...',
    },
    inspectionBoard: {
      badge: '报检列表',
      title: '所有报检记录',
      description: '可按道路、分项、状态、侧别、时间等条件筛选，点击表头可排序；点击行仅勾选，详情请在操作中点击查看。',
      breadcrumb: {
        home: '首页',
        progress: '进度管理',
        current: '报检记录',
      },
      prefabRoadName: '预制',
      errorHint: '加载提示：{message}',
      filters: {
        road: '道路',
        all: '全部',
        phase: '分项',
        side: '侧别',
        sideLeft: '左侧',
        sideRight: '右侧',
        sideBoth: '双侧',
        type: '验收类型',
        typePlaceholder: '试验验收',
        check: '验收内容',
        checkPlaceholder: '钢筋验收',
        status: '状态',
        startPkFrom: '起点桩号 >=（米）',
        startPkTo: '终点桩号 <=（米）',
        startDate: '开始日期',
        endDate: '结束日期',
        keyword: '备注关键字',
        keywordPlaceholder: '仅按备注模糊过滤',
        reset: '重置筛选',
        search: '立即查询',
        addPrefab: '新增预制报检',
        loading: '加载中...',
      },
      typePicker: {
        placeholder: '全部类型',
        selected: '已选 {count} 项',
        summary: '已选 {count}',
        selectAll: '全选',
        clear: '清空',
        all: '全部',
      },
      status: {
        PENDING: '待处理',
        SCHEDULED: '已预约',
        SUBMITTED: '已报检',
        IN_PROGRESS: '验收中',
        APPROVED: '已验收',
      },
      columns: {
        sequence: '序号',
        road: '道路',
        phase: '分项',
        side: '侧别',
        range: '区间',
        layers: '层次',
        checks: '验收内容',
        types: '验收类型',
        submissionOrder: '提交单',
        status: '状态',
        appointmentDate: '预约报检时间',
        submittedAt: '提交时间',
        submittedBy: '提交人',
        remark: '备注',
        createdBy: '创建人',
        createdAt: '创建时间',
        updatedBy: '更新人',
        updatedAt: '更新时间',
        actions: '操作',
      },
      columnSelector: {
        selectedCount: '已选 {count} 列',
        noneSelected: '未选择列',
        selectAll: '全选',
        restore: '恢复默认',
        clear: '清空',
      },
      pdf: {
        export: '导出 PDF',
        preview: '预览 PDF',
        exporting: '生成 PDF 中...',
        previewing: '生成预览中...',
        failed: '导出失败，请稍后重试',
      },
      bulk: {
        selectedCount: '已选 {count} 条',
        missingSelection: '请选择至少一条报检记录',
        delete: '批量删除',
        edit: '批量编辑',
      },
      bulkDelete: {
        badge: '批量删除',
        title: '删除选中的报检记录？',
        hint: '删除后将无法恢复，请确认是否继续。',
        cancel: '取消',
        confirm: '确认删除',
        confirming: '删除中...',
      },
      bulkEdit: {
        badge: '批量编辑',
        title: '批量修改报检',
        hint: '仅填写/选择的字段会被覆盖，其余保持不变。',
        noChange: '不修改',
        noChangeHint: '提示：字段留空即不修改；如需修改里程，请同时填写起点与终点。',
        rangeHint: '留空则不修改，填写需起终点成对出现',
        tokenHint: '多个值用逗号/换行分隔，留空不修改',
        remarkHint: '填写则批量替换备注，留空不变',
        invalidRange: '请填写有效的起止里程',
        invalidSubmittedAt: '送检时间格式无效',
        invalidSubmissionOrder: '提交单必须为数字',
        missingFields: '请至少填写一个需要修改的字段',
        save: '应用批量修改',
        saving: '批量更新中...',
        cancel: '取消',
        closeAria: '关闭批量编辑',
      },
      table: {
        add: '新增报检',
        loading: '加载中...',
        empty: '暂无记录',
        selectPage: '全选当页报检记录',
        selectRow: '选择报检 {index}',
        view: '查看',
        edit: '编辑',
        delete: '删除',
      },
      pagination: {
        summary: '共 {total} 条 · 第 {page}/{totalPages} 页',
        prev: '上一页',
        next: '下一页',
        goTo: '跳转页码',
      },
      prefabModal: {
        badge: '新增预制报检',
        title: '预制 · 报检记录',
        subtitle: '道路固定为“预制”，无侧别与区间。',
        closeAria: '关闭预制报检',
        phaseOptions: {
          ditch: '边沟',
          curb: '路缘石',
          pipe: '圆管涵',
        },
        layerOptions: {
          ditch: '预制边沟',
          curb: '预制路缘石',
          pipe: '预制圆管涵',
        },
        checkOptions: {
          钢筋绑扎验收: '钢筋绑扎验收',
          模版验收: '模版验收',
          混凝土浇筑验收: '混凝土浇筑验收',
        },
        typeOptions: {
          现场验收: '现场验收',
          试验验收: '试验验收',
        },
        phaseLabel: '分项',
        appointmentLabel: '预约报检日期',
        layersLabel: '验收层次',
        typesLabel: '验收类型',
        checksLabel: '验收内容',
        remarkLabel: '备注',
        remarkPlaceholder: '可填写批次、模台号等',
        cancel: '取消',
        submit: '提交预制报检',
        submitting: '创建中...',
      },
      detailModal: {
        badge: '报检详情',
        closeAria: '关闭',
        contentsLabel: '验收内容',
        typesLabel: '验收类型',
        statusLabel: '状态',
        submittedAt: '提交时间',
        updatedAt: '更新时间',
        submittedBy: '提交人',
        remarkLabel: '备注',
        remarkEmpty: '无备注',
        unknownUser: '未知',
      },
      editModal: {
        badge: '编辑报检',
        closeAria: '关闭编辑',
        phaseLabel: '分项',
        phasePlaceholder: '选择分项',
        sideLabel: '侧别',
        sidePlaceholder: '选择侧别',
        sideLeft: '左侧',
        sideRight: '右侧',
        sideBoth: '双侧',
        sidePrefabNote: '—（预制无需侧别）',
        rangeLabel: '起止 PK',
        rangePrefabNote: '—（预制报检无需区间）',
        startLabel: '起点 PK',
        endLabel: '终点 PK',
        layersLabel: '验收层次（逗号分隔）',
        layersPlaceholder: '如：基层，面层',
        checksLabel: '验收内容（逗号分隔）',
        checksPlaceholder: '如：厚度，密实度',
        typesLabel: '验收类型（逗号分隔）',
        typesPlaceholder: '如：试验验收',
        appointmentLabel: '预约日期',
        submittedAtLabel: '提交日期',
        statusLabel: '状态',
        statusPlaceholder: '选择状态',
        submissionOrderLabel: '提交单',
        submissionOrderPlaceholder: '数字，可留空',
        remarkLabel: '备注',
        remarkPlaceholder: '补充说明',
        cancel: '取消',
        save: '保存修改',
        saving: '保存中...',
        invalidRange: '请输入有效的起止里程',
        missingPhase: '请选择分项',
        missingRequired: '层次、验收内容、验收类型均不能为空',
        appointmentMissing: '请选择预约报检日期',
        invalidSubmissionOrder: '提交单需为数字（可留空）',
        saveFailed: '更新失败',
      },
      deleteModal: {
        badge: '删除确认',
        closeAria: '关闭删除确认',
        confirmText: '确定删除该报检记录吗？此操作不可恢复。',
        cancel: '取消',
        confirm: '确认删除',
        confirming: '删除中...',
        failed: '删除失败',
      },
      errors: {
        loadFailed: '加载失败',
        createFailed: '创建失败',
        updateFailed: '更新失败',
        deleteFailed: '删除失败',
        bulkDeleteFailed: '批量删除失败',
        bulkFailed: '批量更新失败',
        exportFailed: '导出失败，请稍后重试',
      },
    },
  },
  fr: {
    hero: {
      badge: 'Avancement',
      title: 'Tableau des routes',
      description:
        'Les tronçons sont créés par les admins (nom + PK début/fin). Les phases, demandes de contrôle et validations se grefferont dessus. Cette page sert d’abord à gérer la liste.',
      home: "Retour à l'accueil",
      reports: 'Ouvrir un rapport',
      loadError:
        'Impossible de charger la liste des routes : {message}. Vous pouvez quand même en créer une, la liste se rafraîchira ensuite.',
    },
    nav: {
      home: 'Accueil',
      progress: "Suivi d'avancement",
      inspections: 'Contrôles',
    },
    access: {
      progressViewHint: "Obtenez le droit progress:view pour accéder au Gantt et aux jalons.",
      progressDetailHint: "Obtenez progress:view pour accéder au Gantt, aux risques et aux détails.",
      inspectionViewHint: "Le droit inspection:view est requis pour voir cette liste.",
    },
    admin: {
      badge: 'Admin',
      title: 'Gestion des tronçons',
      description: "Seuls les admins peuvent maintenir la liste; les phases seront ajoutées ensuite dans le détail.",
      editMode: 'Mode édition · ID {id}',
      saving: 'Enregistrement...',
    },
    form: {
      slugLabel: 'Slug',
      slugPlaceholder: 'ex : bondoukou-university',
      slugTitle: 'Uniquement lettres, chiffres et tirets en minuscules',
      nameLabel: 'Nom',
      namePlaceholder: 'ex : Route du campus',
      startLabel: 'PK début',
      startPlaceholder: 'ex : PK0+000 / carrefour A',
      endLabel: 'PK fin',
      endPlaceholder: 'ex : PK1+940 / tête de pont',
      exitEdit: "Quitter l'édition",
    },
    actions: {
      add: 'Ajouter un tronçon',
      save: 'Enregistrer',
      reset: 'Réinitialiser le formulaire',
      cancel: 'Annuler',
      close: 'Fermer',
    },
    errors: {
      noPermission: 'Pas de droit pour gérer les tronçons',
      saveFailed: "Échec de l'enregistrement, réessayez",
      saveMissing: 'Enregistré, mais aucune donnée retournée',
      deleteFailed: "Échec de la suppression, réessayez",
      loadFailed: 'Route introuvable, retour à la liste.',
    },
    list: {
      overview: 'Vue d’ensemble',
      none: 'Aucun tronçon',
      count: '{count} tronçons',
      emptyHelp:
        'Aucune route pour le moment. Ajoutez-en une avec Nom + PK début/fin depuis le formulaire ci-dessus.',
    },
    card: {
      label: 'Tronçon',
      start: 'Début',
      end: 'Fin',
      slug: 'Slug',
      edit: 'Éditer',
      delete: 'Supprimer',
      workNote:
        'Les phases se configurent dans le détail. Les validations mettront à jour automatiquement les bandes de progression.',
      updated: 'Dernière mise à jour : ',
    },
    detail: {
      badge: 'Détail route',
      slugLine: 'Slug : {slug} · PK début : {start} · PK fin : {end}',
      back: 'Retour à la liste',
      notFoundTitle: 'Route introuvable',
      notFoundBody: 'Aucune route correspondante. Retournez à la liste.',
      backToBoard: 'Retour au tableau',
      breadcrumbProgress: "Suivi d'avancement",
    },
    phase: {
      title: 'Phases',
      roadLengthLabel: 'Longueur estimée : {length} m',
      roadLengthUnknown: 'non renseigné',
      addButton: 'Ajouter une phase',
      manageTip: 'Création/édition via une fenêtre modale, pratique sur mobile.',
      viewOnlyTip: 'Compte sans droit édition : lecture seule.',
      form: {
        editingBadge: 'Éditer la phase · ID {id}',
        creatingBadge: 'Nouvelle phase',
        resetEdit: "Quitter l'édition",
        resetNew: 'Réinitialiser',
        designSummary: 'Longueur estimée : {length} m · Quantité auto : {design}',
        templateLabel: 'Modèle de phase',
        templateCustom: 'Personnalisé / Nouveau',
        nameLabel: 'Nom',
        namePlaceholder: 'ex : Terrassement',
        measureLabel: "Mode d'affichage",
        measureOptionLinear: 'Linéaire (par tronçon)',
        measureOptionPoint: 'Ponctuel (par point/entrée)',
        pointSidesLabel: 'Afficher les points par côté',
        pointSidesHint: 'Utile si les points sont contrôlés gauche/droite séparément; sinon vue unique.',
        designHintPrefix: 'Quantité auto :',
        designHintPoint: '{design} unités (comptées par point)',
        designHintLinear: '{design} m (double si double face)',
        intervalTitle: 'Liste des intervalles (début=fin pour un point)',
        intervalAdd: 'Ajouter un intervalle',
        intervalStart: 'Début',
        intervalEnd: 'Fin',
        intervalSide: 'Côté',
        intervalSpec: 'Spécification',
        intervalBillQuantity: 'Quantité métrée',
        sideBoth: 'Deux côtés',
        sideLeft: 'Gauche',
        sideRight: 'Droite',
        intervalDelete: 'Supprimer',
        layersTitle: 'Couches (candidats pour cette phase)',
        layersAdd: 'Ajouter',
        layersPlaceholder: 'Saisir ou ajouter une couche, ex : couche supérieure',
        layersEmpty: 'Aucune couche sélectionnée. Ajoutez ou choisissez ci-dessus.',
        checksTitle: 'Contenus de contrôle (candidats)',
        checksAdd: 'Ajouter',
        checksPlaceholder: 'ex : densité / planéité',
        checksEmpty: 'Aucun contenu sélectionné. Ajoutez ou choisissez ci-dessus.',
        save: 'Enregistrer la phase',
        saving: 'Enregistrement...',
      },
      note: {
        measure:
          "Le mode d'affichage pilote la visualisation ; la quantité est calculée par intervalle ou point. En linéaire, le double côté double la longueur.",
      },
      view: {
        label: 'Mode de vue',
        road: 'Par tronçon',
        phase: 'Par phase',
      },
      aggregate: {
        empty: 'Aucune donnée de phase disponible',
        roadsLabel: 'Tronçons : {roads}',
        linearSummary: 'Linéaire · Conçu {design} m · Reçu {completed} m · {percent}%',
        pointSummary: 'Unités · Total {design} · Réalisées {completed} · {percent}%',
        moreUnits: '+{count} supplémentaires',
        updatedLabel: 'MàJ : ',
      },
      list: {
        title: 'Phases existantes',
        legend: 'Phases existantes (blanc = à contrôler, cliquable)',
        legendNote: 'Gris = hors design · Blanc = à contrôler',
        empty: 'Aucune phase pour le moment.',
        emptyHint: 'Aucune phase, ouvrez le détail pour en créer.',
      },
      card: {
        measurePoint: 'Ponctuel · Qté {value}',
        measureLinear: 'Linéaire · Qté {value} m',
        completed: 'Achevé {percent}%',
        edit: 'Éditer',
        delete: 'Supprimer',
        deleting: 'Suppression...',
      },
      delete: {
        title: 'Supprimer la phase',
        confirmPrompt: 'Supprimer « {name} » ?',
        impactTitle: 'Conséquences :',
        impactList: [
          '• Intervalles et demandes de contrôle associés seront supprimés (irréversible).',
          '• N’affecte que cette phase, les autres restent inchangées.',
          '• Assurez-vous d’avoir exporté ou sauvegardé les données nécessaires.',
        ],
        cancel: 'Annuler',
        confirmLabel: 'Confirmer',
        confirming: 'Suppression...',
        close: 'Fermer',
      },
      status: {
        pending: 'En attente',
        scheduled: 'Planifié',
        submitted: 'Déposé',
        inProgress: 'En cours',
        approved: 'Validé',
        nonDesign: 'Hors design',
      },
      errors: {
        invalidRange: 'Renseignez un début/fin valides',
        saveFailed: "Échec de l'enregistrement",
        deleteFailed: 'Échec de la suppression',
        submitRangeInvalid: 'Début/fin invalides',
        submitLayerMissing: 'Sélectionnez au moins une couche',
        submitCheckMissing: 'Sélectionnez au moins un contrôle',
        submitTypeMissing: 'Sélectionnez au moins un type',
        submitAppointmentMissing: 'Choisissez une date de rendez-vous',
        submitFailed: "Échec de l'envoi",
        definitionMissing: 'Choisissez un modèle de phase',
      },
      success: {
        created: 'Phase « {name} » créée',
        updated: 'Phase « {name} » mise à jour',
      },
      inspection: {
        title: 'Demande de réception',
        sideLabel: 'Côté',
        sideBoth: 'Deux côtés',
        sideLeft: 'Gauche',
        sideRight: 'Droite',
        startLabel: 'Début',
        startPlaceholder: 'Saisir PK début',
        endLabel: 'Fin',
        endPlaceholder: 'Saisir PK fin',
        appointmentLabel: 'Date de rendez-vous',
        appointmentPlaceholder: 'Choisir une date',
        layersLabel: 'Couches (multi)',
        layersEmpty: 'Aucune couche, ajoutez-les dans la phase.',
        checksLabel: 'Contrôles (multi, ajout libre)',
        checksEmpty: 'Aucun contrôle, ajoutez ou saisissez temporairement.',
        checkPlaceholder: 'Ajouter un contrôle temporaire',
        typesLabel: 'Type de contrôle (multi)',
        typesHint: "Si l'intervalle/côté correspond ci-dessus, envoyez directement ; sinon ajustez.",
        remarkLabel: 'Remarques (multi-lignes)',
        remarkPlaceholder: 'Ajoutez des précisions, consignes, etc.',
        cancel: 'Annuler',
        submit: 'Envoyer',
        submitting: 'Envoi...',
        permissionMissing: 'Droit de contrôle requis',
        dialogTitle: 'Alerte de soumission',
        dialogClose: "J'ai compris",
        dialogBundleMessage:
          'Cette demande inclut des prérequis encore non planifiés : {deps}. Confirmer un contrôle groupé ?',
        dialogBundleConfirm: 'Confirmer le groupement',
        dialogCancel: 'Revenir',
        submitSuccess: 'Demande de contrôle envoyée. Vous pouvez suivre la progression dans la liste.',
        missingDeps: 'Prérequis non planifiés : {deps}',
        missingChecks: 'Contrôles prérequis manquants : {checks}',
        types: ['GENIE CIVIL', 'TOPOGRAPHIQUE', 'GEOTECHNIQUE', 'Autre'],
      },
      alerts: {
        noInspectPermission: 'Droit de contrôle manquant',
        fetchInspectionFailed: 'Impossible de charger les contrôles',
      },
      pointBadge: {
        none: 'Non contrôlé',
      },
      units: {
        point: 'u.',
        linear: 'm',
      },
    },
    workflow: {
      badge: 'Relations',
      title: 'Gestion des relations d’inspection',
      description:
        'Définissez pour chaque phase les couches, contenus et types associés, ainsi que l’ordre à respecter pour éviter les demandes hors séquence.',
      localHint: 'Les règles sont maintenant stockées en base; un modèle “Culvert” est créé par défaut. La validation côté contrôle utilisera ces règles ensuite.',
      accessHint: "Le droit road:manage est requis pour gérer ces relations.",
      actions: {
        save: 'Enregistrer en local',
        reset: 'Réinitialiser',
        addLayer: 'Ajouter une couche',
        deleteLayer: 'Supprimer la couche',
        addCheck: 'Ajouter un contrôle',
        deleteCheck: 'Supprimer le contrôle',
        createTemplate: 'Créer un modèle',
        deleteTemplate: 'Supprimer le modèle',
      },
      templateBadge: 'Modèle',
      templateTitle: 'Choisir un modèle de phase',
      templateHint: 'Chaque phase dispose de sa matrice couches / contenus / types.',
      templateNote: 'Ces règles pilotent les options et validations lors des demandes de contrôle.',
      templateEmpty: 'Aucun modèle, créez-en un pour commencer.',
      templateNameLabel: 'Nom du modèle',
      templateNamePlaceholder: 'Saisir un nom de modèle',
      templateDescriptionLabel: 'Description du modèle',
      templateDescriptionPlaceholder: 'Décrivez le périmètre, les consignes ou points de vigilance',
      templateSideRuleLabel: 'Règle par côté',
      templateSideRulePlaceholder: 'ex : contrôle gauche/droite séparé ou simultané',
      measureLabel: 'Mode d’affichage',
      measureLinear: 'Linéaire',
      measurePoint: 'Unitaire',
      pointHasSidesLabel: 'Séparer les unités par côté',
      newTemplateBadge: 'Nouveau modèle',
      newTemplateTitle: 'Créer un modèle',
      newTemplateHint: 'Renseignez un nom et un mode；ajoutez ensuite les couches/contrôles à droite.',
      newTemplatePlaceholder: 'ex : Fossé, Bordure, Mur de soutènement',
      templateCreated: 'Modèle créé, vous pouvez ajouter couches et contenus.',
      deleted: 'Modèle supprimé ou désactivé.',
      deleteFailed: 'Échec de suppression du modèle',
      errors: {
        templateNameRequired: 'Le nom du modèle est requis',
      },
      bindingLayers: 'Couches : {count}',
      bindingChecks: 'Contenus : {count}',
      ruleBadge: 'Règles',
      ruleTitle: 'Dépendances et verrouillage',
      ruleHint: 'Définissez les prérequis, les contrôles groupés et l’ordre des contenus.',
      quick: {
        layerTitle: 'Actions rapides sur les couches',
        layerHint: 'Saisissez un nom et un ordre pour ajouter une couche ; suppression avec nettoyage des dépendances.',
        deletePlaceholder: 'Choisir une couche à supprimer',
        checkPlaceholder: 'Nom du contenu de contrôle',
      },
      layerNote: 'Notes de couche (contraintes, points de vigilance).',
      stageLabel: 'Ordre',
      dependsLabel: 'Pré-requis (doivent être validés avant)',
      lockLabel: 'Verrouiller avec',
      parallelLabel: 'Peut être en parallèle',
      checkTitle: 'Ordre des contenus',
      checkNote: 'Notes du contrôle (bétonnage groupé, éprouvettes, etc.)',
      newLayer: 'Nouvelle couche',
      newCheck: 'Nouveau contenu',
      noPeers: 'Aucune autre couche',
      timelineBadge: 'Vue',
      timelineTitle: '{phase} · Vue de flux',
      timelineHint: 'Colonnes par étape avec prérequis, groupes verrouillés et types liés.',
      legend: {
        locked: 'Verrou obligatoire',
        parallel: 'Parallèle possible',
        types: 'Types liés',
      },
      stageName: 'Étape {value}',
      stageHint: 'Commence après la fin des étapes précédentes',
      stageCountPrefix: 'Couches',
      timelineDepends: 'Pré-requis : {deps}',
      timelineFree: 'Sans prérequis',
      lockedWith: 'Verrouillé avec {peers}',
      parallelWith: 'Parallèle avec {peers}',
      summaryTitle: 'Résumé des règles',
      summaryHint: 'À vérifier : prérequis, groupes verrouillés, ordre et types liés.',
      summaryEmpty: 'Aucune dépendance définie.',
      ruleDepends: '{name} dépend de {deps}',
      ruleLock: '{name} doit être contrôlé avec {peers}',
      saved: 'Enregistré côté serveur.',
      reset: 'Réinitialisé sur le modèle par défaut (non enregistré).',
      empty: 'Aucun modèle disponible',
      saveFailed: 'Échec de sauvegarde, réessayez.',
      saving: 'Enregistrement...',
    },
    inspectionBoard: {
      badge: 'Contrôles',
      title: 'Toutes les demandes',
      description:
        'Filtrez par route, phase, statut, côté ou dates; tri possible via les entêtes. Clic sur une ligne = sélection, détail via les actions.',
      breadcrumb: {
        home: 'Accueil',
        progress: "Suivi d'avancement",
        current: 'Contrôles',
      },
      prefabRoadName: 'Préfab',
      errorHint: 'Alerte chargement : {message}',
      filters: {
        road: 'Route',
        all: 'Tout',
        phase: 'Phase',
        side: 'Côté',
        sideLeft: 'Gauche',
        sideRight: 'Droite',
        sideBoth: 'Deux côtés',
        type: 'Type de contrôle',
        typePlaceholder: 'ex : Contrôle labo',
        check: 'Contenu',
        checkPlaceholder: 'ex : Armatures',
        status: 'Statut',
        startPkFrom: 'PK début ≥ (m)',
        startPkTo: 'PK fin ≤ (m)',
        startDate: 'Début',
        endDate: 'Fin',
        keyword: 'Mot-clé (remarque)',
        keywordPlaceholder: 'Filtrer seulement la remarque',
        reset: 'Réinitialiser',
        search: 'Rechercher',
        addPrefab: 'Ajouter contrôle préfab',
        loading: 'Chargement...',
      },
      typePicker: {
        placeholder: 'Tous les types',
        selected: 'Sélection : {count}',
        summary: 'Sélection : {count}',
        selectAll: 'Tout sélectionner',
        clear: 'Effacer',
        all: 'Tout',
      },
      status: {
        PENDING: 'À traiter',
        SCHEDULED: 'Planifié',
        SUBMITTED: 'Envoyé',
        IN_PROGRESS: 'En contrôle',
        APPROVED: 'Validé',
      },
      columns: {
        sequence: 'N°',
        road: 'Route',
        phase: 'Phase',
        side: 'Côté',
        range: 'Intervalle',
        layers: 'Couches',
        checks: 'Contenus',
        types: 'Types',
        submissionOrder: 'N° de soumission',
        status: 'Statut',
        appointmentDate: 'Rendez-vous',
        submittedAt: 'Soumis',
        submittedBy: 'Soumis par',
        remark: 'Remarques',
        createdBy: 'Créé par',
        createdAt: 'Créé le',
        updatedBy: 'Mis à jour par',
        updatedAt: 'Mis à jour le',
        actions: 'Actions',
      },
      columnSelector: {
        selectedCount: 'Colonnes : {count}',
        noneSelected: 'Aucune colonne',
        selectAll: 'Tout',
        restore: 'Défaut',
        clear: 'Vider',
      },
      pdf: {
        export: 'Exporter en PDF',
        preview: 'Prévisualiser',
        exporting: 'Génération du PDF...',
        previewing: 'Prévisualisation...',
        failed: "Échec de l'export, réessayez.",
      },
      bulk: {
        selectedCount: '{count} sélection',
        missingSelection: 'Sélectionnez au moins un contrôle',
        delete: 'Suppression groupée',
        edit: 'Édition groupée',
      },
      bulkDelete: {
        badge: 'Suppression groupée',
        title: 'Supprimer les contrôles sélectionnés ?',
        hint: 'Cette action est définitive. Voulez-vous continuer ?',
        cancel: 'Annuler',
        confirm: 'Confirmer',
        confirming: 'Suppression...',
      },
      bulkEdit: {
        badge: 'Édition groupée',
        title: 'Modifier plusieurs contrôles',
        hint: 'Seuls les champs remplis seront appliqués, les autres restent inchangés.',
        noChange: 'Ne pas modifier',
        noChangeHint: 'Astuce : champ vide = pas de modification. Pour modifier les PK, saisir début et fin.',
        rangeHint: 'Laissez vide pour conserver, saisir début + fin pour modifier',
        tokenHint: 'Séparez par virgules / retours ligne, vide = pas de changement',
        remarkHint: 'Saisi = remplace toutes les remarques sélectionnées; vide = ne change pas',
        invalidRange: 'Veuillez saisir une plage PK valide',
        invalidSubmittedAt: 'Horodatage de soumission invalide',
        invalidSubmissionOrder: 'Le numéro de soumission doit être numérique',
        missingFields: 'Renseignez au moins un champ à modifier',
        save: 'Appliquer',
        saving: 'Mise à jour...',
        cancel: 'Annuler',
        closeAria: 'Fermer l’édition groupée',
      },
      table: {
        add: 'Ajouter un contrôle',
        loading: 'Chargement...',
        empty: 'Aucune donnée',
        selectPage: 'Tout sélectionner sur cette page',
        selectRow: 'Sélectionner le contrôle {index}',
        view: 'Voir',
        edit: 'Éditer',
        delete: 'Supprimer',
      },
      pagination: {
        summary: '{total} au total · Page {page}/{totalPages}',
        prev: 'Précédent',
        next: 'Suivant',
        goTo: 'Aller à la page',
      },
      prefabModal: {
        badge: 'Nouveau contrôle préfab',
        title: 'Préfab · Contrôles',
        subtitle: 'Route fixée sur « Préfab », pas de côté ni d’intervalle.',
        closeAria: 'Fermer la fenêtre préfab',
        phaseOptions: {
          ditch: 'Caniveau préfabriqué',
          curb: 'Bordure préfabriquée',
          pipe: 'Buse circulaire préfab',
        },
        layerOptions: {
          ditch: 'Caniveau préfab',
          curb: 'Bordure préfab',
          pipe: 'Buse préfab',
        },
        checkOptions: {
          钢筋绑扎验收: 'Réception armatures',
          模版验收: 'Réception coffrage',
          混凝土浇筑验收: 'Réception bétonnage',
        },
        typeOptions: {
          现场验收: 'Contrôle terrain',
          试验验收: 'Contrôle labo',
        },
        phaseLabel: 'Phase',
        appointmentLabel: 'Date de contrôle',
        layersLabel: 'Couches',
        typesLabel: 'Types',
        checksLabel: 'Contenus',
        remarkLabel: 'Remarques',
        remarkPlaceholder: 'Lot, moule, etc.',
        cancel: 'Annuler',
        submit: 'Envoyer',
        submitting: 'Création...',
      },
      detailModal: {
        badge: 'Détail contrôle',
        closeAria: 'Fermer',
        contentsLabel: 'Contenus',
        typesLabel: 'Types',
        statusLabel: 'Statut',
        submittedAt: 'Soumis le',
        updatedAt: 'Mise à jour',
        submittedBy: 'Soumis par',
        remarkLabel: 'Remarques',
        remarkEmpty: 'Aucune remarque',
        unknownUser: 'Inconnu',
      },
      editModal: {
        badge: 'Éditer contrôle',
        closeAria: "Fermer l’édition",
        phaseLabel: 'Phase',
        phasePlaceholder: 'Choisir une phase',
        sideLabel: 'Côté',
        sidePlaceholder: 'Choisir un côté',
        sideLeft: 'Gauche',
        sideRight: 'Droite',
        sideBoth: 'Deux côtés',
        sidePrefabNote: '— (Préfab : pas de côté)',
        rangeLabel: 'PK début/fin',
        rangePrefabNote: '— (Préfab : pas d’intervalle)',
        startLabel: 'PK début',
        endLabel: 'PK fin',
        layersLabel: 'Couches (séparées par des virgules)',
        layersPlaceholder: 'ex : couche base, couche finie',
        checksLabel: 'Contenus (séparées par des virgules)',
        checksPlaceholder: 'ex : épaisseur, densité',
        typesLabel: 'Types (séparés par des virgules)',
        typesPlaceholder: 'ex : Contrôle labo',
        appointmentLabel: 'Date de rendez-vous',
        submittedAtLabel: 'Date de soumission',
        statusLabel: 'Statut',
        statusPlaceholder: 'Choisir un statut',
        submissionOrderLabel: 'N° de soumission',
        submissionOrderPlaceholder: 'Nombre, optionnel',
        remarkLabel: 'Remarques',
        remarkPlaceholder: 'Compléments',
        cancel: 'Annuler',
        save: 'Enregistrer',
        saving: 'Enregistrement...',
        invalidRange: 'PK début/fin invalides',
        missingPhase: 'Choisissez une phase',
        missingRequired: 'Couches, contenus et types ne peuvent pas être vides',
        appointmentMissing: 'Choisissez une date',
        invalidSubmissionOrder: 'Le numéro de soumission doit être un nombre (ou laisser vide)',
        saveFailed: 'Échec de la mise à jour',
      },
      deleteModal: {
        badge: 'Confirmation de suppression',
        closeAria: 'Fermer la confirmation',
        confirmText: 'Supprimer ce contrôle ? Action irréversible.',
        cancel: 'Annuler',
        confirm: 'Confirmer',
        confirming: 'Suppression...',
        failed: 'Échec de la suppression',
      },
      errors: {
        loadFailed: 'Chargement impossible',
        createFailed: 'Échec de création',
        updateFailed: 'Échec de mise à jour',
        deleteFailed: 'Échec de suppression',
        bulkDeleteFailed: 'Échec de la suppression groupée',
        bulkFailed: 'Échec de la mise à jour groupée',
        exportFailed: "Échec de l'export PDF",
      },
    },
  },
}

export const getProgressCopy = (locale: Locale) => progressCopy[locale]

export const formatProgressCopy = (
  template: string,
  values: Record<string, string | number>,
): string => formatCopy(template, values)
