import type { Locale, LocalizedString } from './index'

export type EmploymentStatus = 'ACTIVE' | 'TERMINATED' | 'ON_LEAVE'

export type NationalityRegion =
  | 'china'
  | 'west-africa'
  | 'central-africa'
  | 'east-africa'
  | 'southern-africa'

export interface NationalityOption {
  key: string
  regions: NationalityRegion[]
  label: LocalizedString
}

export const memberCopy: Record<
  Locale,
  {
    title: string
    subtitle: string
    modalSubtitle: string
    editTitle: string
    editSubtitle: string
    breadcrumbs: {
      home: string
      members: string
      memberEdit: string
    }
    tabs: Record<'overview' | 'members' | 'roles' | 'permissions' | 'payroll', string>
    tabDescriptions: Record<'overview' | 'members' | 'roles' | 'permissions' | 'payroll', string>
    overview: {
      title: string
      subtitle: string
      filters: {
        tagLabel: string
        tagHint: string
      }
      summary: {
        total: string
        china: string
        nonChina: string
        local: string
      }
      charts: {
        nationality: string
        team: string
        supervisor: string
        teamCostScatter: string
        teamCostShare: string
        dataQuality: string
        provenance: string
        salary: string
        actualSalary: string
        contractCost: string
        position: string
        age: string
        tenure: string
        contractExpiry: string
        detailPayrollTotal: string
        detailPayrollAverage: string
        contractTypeTrend: string
        salaryPyramid: string
        payoutRecords: string
      }
      labels: {
        total: string
        people: string
        noData: string
        other: string
        unassignedTeam: string
        unassignedSupervisor: string
        missingProvenance: string
        missingContractType: string
        missingContractDate: string
        missingPhone: string
        missingPhoneHint: string
        missingCnps: string
        missingCnpsWithoutDeclaration: string
        expiringSoon: string
        overdue: string
        beyond: string
        scopeAll: string
        localScope: string
        china: string
        nonChina: string
        payrollTotal: string
        payrollAverage: string
        payrollMedian: string
        payrollRatio: string
        teamSortCount: string
        teamSortAvg: string
        teamSortMedian: string
        modeOverview: string
        modeDetail: string
        modeCompare: string
        scatterHint: string
        missingBirthDate: string
        missingPosition: string
        positionDetailTitle: string
        positionDetailHint: string
        positionDetailClear: string
        detailTeams: string
        detailTeamsHint: string
        ctj: string
        cdd: string
        delta: string
        payoutTotal: string
        dataQualityHint: string
        compareHint: string
      }
      helpers: {
        salaryRule: string
        actualSalaryRule: string
        actualSalaryRuleDetail: string
        positionRule: string
      }
      positionGroups: Record<
        | 'safetyHse'
        | 'labQuality'
        | 'plantQuarry'
        | 'surveyTopo'
        | 'maintenance'
        | 'equipmentOps'
        | 'driversTransport'
        | 'livingServices'
        | 'warehouseLogistics'
        | 'supervision'
        | 'adminSupport'
        | 'siteWork'
        | 'other',
        string
      >
    }
    stats: Record<'headcount' | 'active' | 'roles' | 'coverage', string>
    helpers: {
      permissionCoverage: string
      permissionFormat: string
    }
    columnSelector: {
      label: string
      selectAll: string
      restore: string
      clear: string
      selectGroup: string
      clearGroup: string
    }
    fieldGroups: {
      basicInfo: string
      contract: string
      salary: string
      localProfile: string
      chineseProfile: string
    }
    filters: {
      title: string
      all: string
      selected: (count: number) => string
      selectAll: string
      clear: string
      reset: string
      searchPlaceholder: string
      noOptions: string
      collapse: string
      expand: string
      payrollMonth: string
    }
    pagination: {
      summary: (total: number, page: number, totalPages: number) => string
      pageSizeLabel: string
      prev: string
      next: string
      goTo: string
    }
    listHeading: string
    status: Record<EmploymentStatus, string>
    table: Record<
      | 'name'
      | 'sequence'
      | 'username'
      | 'gender'
      | 'nationality'
      | 'phones'
      | 'joinDate'
      | 'birthDate'
      | 'position'
      | 'employmentStatus'
      | 'roles'
      | 'tags'
      | 'project'
      | 'team'
      | 'chineseSupervisor'
      | 'contractNumber'
      | 'contractType'
      | 'contractStartDate'
      | 'contractEndDate'
      | 'salaryCategory'
      | 'prime'
      | 'baseSalary'
      | 'netMonthly'
      | 'maritalStatus'
      | 'childrenCount'
      | 'cnpsNumber'
      | 'cnpsDeclarationCode'
      | 'provenance'
      | 'frenchName'
      | 'idNumber'
      | 'passportNumber'
      | 'educationAndMajor'
      | 'certifications'
      | 'domesticMobile'
      | 'emergencyContactName'
      | 'emergencyContactPhone'
      | 'redBookValidYears'
      | 'cumulativeAbroadYears'
      | 'birthplace'
      | 'residenceInChina'
      | 'medicalHistory'
      | 'healthStatus'
      | 'terminationDate'
      | 'terminationReason'
      | 'createdAt'
      | 'updatedAt'
      | 'actions'
      | 'positionManaged'
      | 'userCount'
      | 'created'
      | 'updated'
    ,
      string
    >
    actions: {
      create: string
      import: string
      importContractChanges: string
      contractAudit: string
      export: string
      template: string
      contractChangeTemplate: string
      clearSort: string
      search: string
      saveAndSwitch: string
      discardAndSwitch: string
      auditTrail: string
      view: string
      edit: string
      delete: string
      save: string
      saveChanges: string
      cancel: string
      createRole: string
      bulkEdit: string
      clearValue: string
      teamSupervisors: string
    }
    access: {
      hint: string
      needMemberView: string
      needRoleView: string
      needPermissionView: string
      needPayrollView: string
    }
    errors: {
      needRoleCreate: string
      needRoleUpdate: string
      needRoleDelete: string
      needMemberCreate: string
      needMemberUpdate: string
      needMemberDelete: string
      needPermissionUpdate: string
      permissionUpdateFailed: string
      nameRequired: string
      usernameRequired: string
      passwordRequired: string
      birthDateRequired: string
      birthDateInvalid: string
      terminationDateRequired: string
      terminationReasonRequired: string
      terminationDateInvalid: string
      roleNameRequired: string
      roleDeleteConfirm: string
      exportMissingColumns: string
      exportNoData: string
      exportFailed: string
      templateDownloadFailed: string
      importInvalidFile: string
      importMissingHeaders: string
      importNoData: string
      importDuplicateUsername: string
      importDuplicateIdentity: string
      importMemberNotFound: string
      importChineseMember: string
      importUsernameExists: string
      importInvalidGender: string
      importInvalidPhone: string
      importInvalidProject: string
      importInvalidContractType: string
      importInvalidSalaryUnit: string
      importInvalidBaseSalaryUnit: string
      importInvalidStatus: string
      importInvalidJoinDate: string
      importInvalidStartDate: string
      importInvalidEndDate: string
      importInvalidChangeDate: string
      importMissingBirthDate: string
      importInvalidBirthDate: string
      importInvalidChineseSupervisor: string
      importDuplicateContractNumber: string
      importContractNumberExists: string
      importMissingTeamSupervisor: string
      importContractChangeMissingFields: string
      importRoleNotFound: (role: string) => string
      importFailed: string
      baseSalaryUnitInvalid: string
    }
    template: {
      instructionsSheet: string
      columnsHeader: string
      notesHeader: string
      notes: Record<
        | 'name'
        | 'username'
        | 'password'
        | 'gender'
        | 'nationality'
        | 'phones'
        | 'tags'
        | 'joinDate'
        | 'birthDate'
        | 'position'
        | 'employmentStatus'
        | 'roles'
        | 'project'
        | 'team'
        | 'chineseSupervisor'
        | 'contractNumber'
        | 'contractType'
        | 'contractStartDate'
        | 'contractEndDate'
        | 'salaryCategory'
        | 'prime'
        | 'baseSalary'
        | 'netMonthly'
        | 'maritalStatus'
        | 'childrenCount'
        | 'cnpsNumber'
        | 'cnpsDeclarationCode'
        | 'provenance'
        | 'emergencyContact'
        | 'frenchName'
        | 'idNumber'
        | 'passportNumber'
        | 'educationAndMajor'
        | 'certifications'
        | 'domesticMobile'
        | 'emergencyContactName'
        | 'emergencyContactPhone'
        | 'redBookValidYears'
        | 'cumulativeAbroadYears'
        | 'birthplace'
        | 'residenceInChina'
        | 'medicalHistory'
        | 'healthStatus'
        | 'terminationDate'
        | 'terminationReason',
        string
      >
    }
    contractChangeTemplate: {
      instructionsSheet: string
      columnsHeader: string
      notesHeader: string
      notes: Record<
        | 'name'
        | 'birthDate'
        | 'team'
        | 'position'
        | 'contractNumber'
        | 'contractType'
        | 'salaryCategory'
        | 'salaryAmount'
        | 'salaryUnit'
        | 'baseSalary'
        | 'prime'
        | 'startDate'
        | 'endDate'
        | 'changeDate'
        | 'reason'
        | 'chineseSupervisor',
        string
      >
    }
    rolePanel: {
      title: string
      editTitle: string
      subtitle: string
      namePlaceholder: string
      countPrefix: string
      countUnit: string
      members: string
      permissions: string
      primary: string
    }
    permissionPanel: {
      title: string
      code: string
      description: string
      roles: string
      status: string
      edit: string
      statusLabels: Record<'ACTIVE' | 'ARCHIVED', string>
      helper: string
    }
    signaturePanel: {
      title: string
      hint: string
      upload: string
      uploading: string
      current: string
      history: string
      empty: string
      loading: string
      previewAlt: string
      viewDenied: string
      setActive: string
      activating: string
      active: string
      delete: string
      deleting: string
      loadError: string
      uploadFailed: string
      activateFailed: string
      deleteFailed: string
      versionLabel: (version: number) => string
    }
    teamSupervisor: {
      title: string
      subtitle: string
      add: string
      team: string
      teamZh: string
      supervisor: string
      project: string
      edit: string
      delete: string
      confirm: string
      cancel: string
      empty: string
      missing: string
      teamRequired: string
      supervisorRequired: string
      teamPlaceholder: string
      teamZhPlaceholder: string
      deleteConfirm: (team: string) => string
    }
    form: {
      name: string
      namePlaceholder: string
      username: string
      password: string
      passwordPlaceholder: string
      gender: string
      nationality: string
      phones: string
      phonePlaceholder: string
      addPhone: string
      phoneSaved: (count: number) => string
      joinDate: string
      birthDate: string
      position: string
      status: string
      roles: string
      tags: string
      tagsPlaceholder: string
      nationalityPlaceholder: string
      roleName: string
      positionPlaceholder: string
      profileSection: string
      profileChinaHint: string
      profileExpatHint: string
      expand: string
      collapse: string
      expatEmpty: string
      team: string
      project: string
      chineseSupervisor: string
      contractNumber: string
      contractType: string
      contractStartDate: string
      contractEndDate: string
      salaryCategory: string
      prime: string
      baseSalary: string
      baseSalaryAmount: string
      baseSalaryUnit: string
      netMonthly: string
      netMonthlyAmount: string
      netMonthlyUnit: string
      salaryUnitMonth: string
      salaryUnitHour: string
      maritalStatus: string
      childrenCount: string
      cnpsNumber: string
      cnpsDeclarationCode: string
      provenance: string
      emergencyContact: string
      frenchName: string
      idNumber: string
      passportNumber: string
      educationAndMajor: string
      certifications: string
      certificationsPlaceholder: string
      domesticMobile: string
      emergencyContactName: string
      emergencyContactPhone: string
      redBookValidYears: string
      cumulativeAbroadYears: string
      birthplace: string
      residenceInChina: string
      medicalHistory: string
      healthStatus: string
      terminationDate: string
      terminationReason: string
      skipChangeHistory: string
    }
    feedback: {
      loading: string
      loadError: string
      empty: string
      emptyHistory: string
      submitError: string
      deleteConfirm: (username: string) => string
      importSuccess: (count: number) => string
      importContractChangesSuccess: (count: number) => string
      importRowError: (row: number, message: string) => string
      importSkipConfirm: (validCount: number, errorCount: number) => string
      importPartialSuccess: (imported: number, skipped: number) => string
      contractAuditReady: (path: string) => string
      bulkSaveSuccess: (count: number) => string
      bulkSavePartial: (success: number, failed: number) => string
      bulkSaveEmpty: string
    }
    labels: {
      empty: string
      today: string
      close: string
      cleared: string
      selectTeam: string
      selectMember: string
      unsavedTitle: string
      unsavedDescription: string
      unsavedBadge: string
    }
    compensation: {
      title: string
      contractChanges: string
      payrollChanges: string
      payrollPayouts: string
      addContractChange: string
      addPayrollChange: string
      addPayrollPayout: string
      editContractChange: string
      editPayrollChange: string
      editPayrollPayout: string
      fields: {
        changeDate: string
        startDate: string
        endDate: string
        reason: string
        payoutDate: string
        amount: string
        currency: string
        note: string
        team: string
        chineseSupervisor: string
      }
      actions: {
        save: string
        cancel: string
        edit: string
        delete: string
        refresh: string
      }
    }
    payroll: {
      title: string
      subtitle: string
      monthLabel: string
      viewModes: {
        entry: string
        report: string
      }
      runLabels: {
        first: string
        second: string
      }
      fields: {
        attendanceCutoffDate: string
      }
      actions: {
        useToday: string
        saveDate: string
        saveRun: string
        clearRun: string
        importPayouts: string
        bulkPaste: string
        applyPaste: string
        clearPaste: string
        exportPdf: string
        exportingPdf: string
        exportAttendance: string
        exportingAttendance: string
      }
      confirm: {
        clearRun: (label: string) => string
      }
      bulkHint: string
      filters: {
        keyword: string
        includeInactive: string
      }
      stats: {
        total: string
        ctj: string
        cdd: string
      }
      table: {
        runEmpty: string
        total: string
      }
      empty: string
      errors: {
        loadFailed: string
        saveFailed: string
        missingAmount: (count: number) => string
        exportFailed: string
        exportAttendanceFailed: string
        importInvalidTargets: string
        importErrorTitle: string
        importErrorSummary: (count: number) => string
        importMissingHeaders: string
        importContractNotFound: (contract: string) => string
      }
    }
    drawer: {
      tabs: Record<'overview' | 'contracts' | 'payroll', string>
      sections: {
        basicInfo: string
        contract: string
        salary: string
        personal: string
        chineseProfile: string
        emergencyContact: string
      }
      comingSoon: {
        contracts: string
        payroll: string
      }
    }
  }
> = {
  zh: {
    title: '成员管理',
    subtitle: '集中维护成员信息、角色与权限映射，支持导入/导出与审计记录。',
    modalSubtitle: '录入基础字段，扩展资料可选填写。',
    editTitle: '编辑成员资料',
    editSubtitle: '更新基础信息与扩展字段。',
    breadcrumbs: {
      home: '首页',
      members: '成员管理',
      memberEdit: '编辑成员',
    },
    tabs: {
      overview: '数据概览',
      members: '成员列表',
      roles: '角色管理',
      permissions: '权限管理',
      payroll: '工资发放',
    },
    tabDescriptions: {
      overview: '全量成员数据概览与结构对比。',
      members: '筛选成员、导入导出与审计记录视图。',
      roles: '梳理角色职责并查看成员覆盖与权限绑定。',
      permissions: '审视权限编码、描述与角色覆盖范围。',
      payroll: '按月两次批量录入并生成发放报表。',
    },
    overview: {
      title: '数据概览',
      subtitle: '基于全量成员数据进行分析（不区分在职/离职）。',
      filters: {
        tagLabel: '项目标签筛选',
        tagHint: '可选：按成员标签过滤后查看对比。',
      },
      summary: {
        total: '成员总数',
        china: '中国籍',
        nonChina: '非中国籍',
        local: '本地员工',
      },
      charts: {
        nationality: '中外人员占比',
        team: '班组分析',
        supervisor: '中方负责人',
        teamCostScatter: '班组热力',
        teamCostShare: '成本集中度',
        dataQuality: '人工处理清单',
        provenance: '籍贯/属地分布',
        salary: '合同薪资区间占比',
        actualSalary: '实发薪资区间占比',
        contractCost: '合同类型成本对比',
        position: '岗位分布',
        age: '年龄分布',
        tenure: '员工司龄分布',
        contractExpiry: '合同到期分布（未来 3 个月）',
        detailPayrollTotal: '月度实发总额趋势',
        detailPayrollAverage: '月度人均工资趋势',
        contractTypeTrend: '合同类型人数趋势',
        salaryPyramid: '薪酬结构金字塔',
        payoutRecords: '发放记录',
      },
      labels: {
        total: '总数',
        people: '人',
        noData: '暂无数据',
        other: '其他',
        unassignedTeam: '未分配班组',
        unassignedSupervisor: '未绑定负责人',
        missingProvenance: '未填写籍贯',
        missingContractType: '未填写合同类型',
        missingContractDate: '未填写到期日',
        missingPhone: '缺失电话号码',
        missingPhoneHint: '含 0500000000 视为缺失',
        missingCnps: '缺失 CNPS 编号',
        missingCnpsWithoutDeclaration: '缺失 CNPS 编号且无申报码',
        expiringSoon: '未来 3 个月',
        overdue: '已到期',
        beyond: '超过 3 个月',
        scopeAll: '全员范围',
        localScope: '仅非中国籍',
        china: '中国籍',
        nonChina: '非中国籍',
        payrollTotal: '上月实发',
        payrollAverage: '人均',
        payrollMedian: '中位',
        payrollRatio: '均/中',
        teamSortCount: '人数',
        teamSortAvg: '均薪',
        teamSortMedian: '中位',
        modeOverview: '概览',
        modeDetail: '详情',
        modeCompare: '对比',
        scatterHint: '颜色=列内相对值。均/中：值越大，高薪越集中；接近 1，分布越均衡；过低提示异常。',
        missingBirthDate: '未填写出生日期',
        missingPosition: '未填写岗位',
        positionDetailTitle: '岗位细分',
        positionDetailHint: '点击分类查看细分',
        positionDetailClear: '收起',
        detailTeams: '班组选择',
        detailTeamsHint: '点击班组或负责人卡片可跳转分析',
        ctj: 'CTJ',
        cdd: 'CDD',
        delta: '较上月',
        payoutTotal: '发放总额',
        dataQualityHint: '这些字段需要人工补录或核对',
        compareHint: '请选择至少 2 个班组进行对比。',
      },
      helpers: {
        salaryRule: '合同口径：CTJ 时薪按 22 天 × 8 小时折算月薪；月薪优先取实发工资，否则用基础工资 + 津贴。',
        actualSalaryRule: '实发口径：所选月份月中 + 月末汇总，仅计已发金额。',
        actualSalaryRuleDetail: '实发口径：所选月份月中 + 月末汇总，按月均计算，仅计已发金额。',
        positionRule: '岗位按关键词归一化，原始数据不变。',
      },
      positionGroups: {
        safetyHse: '安全/HSE',
        labQuality: '实验室/质量',
        plantQuarry: '拌合站/破碎/采石',
        surveyTopo: '测量',
        maintenance: '维修/机电',
        equipmentOps: '设备操作',
        driversTransport: '驾驶/运输',
        livingServices: '后勤/生活服务',
        warehouseLogistics: '仓储/物流',
        supervision: '领班/管理',
        adminSupport: '行政/支持',
        siteWork: '施工/土建',
        other: '其他/未归一',
      },
    },
    stats: {
      headcount: '成员总数',
      active: '在职成员',
      roles: '角色数',
      coverage: '权限覆盖',
    },
    helpers: {
      permissionCoverage: '权限条目',
      permissionFormat: '权限遵循资源-动作编码，可直接复用到 API 鉴权策略。',
    },
    columnSelector: {
      label: '列显示',
      selectAll: '全选',
      restore: '恢复默认',
      clear: '清空',
      selectGroup: '选中本组',
      clearGroup: '取消本组',
    },
    fieldGroups: {
      basicInfo: '基本信息',
      contract: '合同',
      salary: '工资',
      localProfile: '当地员工',
      chineseProfile: '中方人员',
    },
    filters: {
      title: '筛选',
      all: '全部',
      selected: (count: number) => `已选 ${count} 项`,
      selectAll: '全选',
      clear: '清空',
      reset: '清空筛选',
      searchPlaceholder: '搜索',
      noOptions: '暂无可选项',
      collapse: '收起筛选',
      expand: '展开筛选',
      payrollMonth: '工资月份',
    },
    pagination: {
      summary: (total: number, page: number, totalPages: number) =>
        `共 ${total} 条，当前第 ${page} / ${totalPages} 页`,
      pageSizeLabel: '每页行数',
      prev: '上一页',
      next: '下一页',
      goTo: '跳转到页码',
    },
    listHeading: '成员列表',
    status: {
      ACTIVE: '在职',
      TERMINATED: '离职',
      ON_LEAVE: '休假',
    },
    table: {
      sequence: '序号',
      name: '姓名',
      username: '账号',
      gender: '性别',
      nationality: '国籍',
      phones: '电话',
      joinDate: '入职',
      birthDate: '出生日期',
      position: '岗位',
      employmentStatus: '状态',
      roles: '角色',
      tags: '标签',
      project: '项目',
      team: '班组',
      chineseSupervisor: '中方负责人',
      contractNumber: '合同编号',
      contractType: '合同类型',
      contractStartDate: '合同开始日期',
      contractEndDate: '合同结束日期',
      salaryCategory: '工资等级',
      prime: '奖金',
      baseSalary: '基础工资',
      netMonthly: '实发工资',
      maritalStatus: '婚姻状态',
      childrenCount: '子女数量',
      cnpsNumber: 'CNPS 编号',
      cnpsDeclarationCode: 'CNPS 申报码',
      provenance: '籍贯/属地',
      frenchName: '法语名',
      idNumber: '身份证号',
      passportNumber: '护照号',
      educationAndMajor: '学历/专业',
      certifications: '资格证书',
      domesticMobile: '国内手机',
      emergencyContactName: '紧急联系人',
      emergencyContactPhone: '紧急联系电话',
      redBookValidYears: '红皮书年限',
      cumulativeAbroadYears: '累计出国年限',
      birthplace: '籍贯',
      residenceInChina: '国内常住地',
      medicalHistory: '既往病史',
      healthStatus: '健康状况',
      terminationDate: '离职日期',
      terminationReason: '离职原因',
      createdAt: '创建时间',
      updatedAt: '更新时间',
      actions: '操作',
      positionManaged: '岗位',
      userCount: '关联成员',
      created: '创建',
      updated: '更新',
    },
    actions: {
      create: '新增成员',
      import: '导入成员',
      importContractChanges: '导入合同变更',
      contractAudit: '合同核对',
      export: '导出 Excel/CSV',
      template: '成员导入模板',
      contractChangeTemplate: '合同变更模板',
      clearSort: '清空排序',
      search: '搜索',
      saveAndSwitch: '保存并切换',
      discardAndSwitch: '舍弃并切换',
      auditTrail: '审计日志',
      view: '详情',
      edit: '编辑',
      delete: '删除',
      save: '保存',
      saveChanges: '保存修改',
      cancel: '取消',
      createRole: '新增角色',
      bulkEdit: '批量修改',
      clearValue: '清空',
      teamSupervisors: '班组负责人',
    },
    access: {
      hint: '请先登录并开通 member:view 权限后再试。',
      needMemberView: '缺少 member:view 权限，无法查看成员列表。',
      needRoleView: '缺少 role:view 权限，无法查看角色列表。',
      needPermissionView: '缺少 permission:view 权限，无法查看权限列表。',
      needPayrollView: '缺少 payroll:view 权限，无法查看工资发放。',
    },
    errors: {
      needRoleCreate: '缺少角色创建权限',
      needRoleUpdate: '缺少角色更新权限',
      needRoleDelete: '缺少角色删除权限',
      needMemberCreate: '缺少成员新增权限',
      needMemberUpdate: '缺少成员更新权限',
      needMemberDelete: '缺少成员删除权限',
      needPermissionUpdate: '缺少权限更新权限',
      permissionUpdateFailed: '更新权限状态失败',
      nameRequired: '姓名必填',
      usernameRequired: '账号必填',
      passwordRequired: '初始密码必填',
      birthDateRequired: '出生日期必填',
      birthDateInvalid: '出生日期格式不正确',
      terminationDateRequired: '离职日期必填',
      terminationReasonRequired: '离职原因必填',
      terminationDateInvalid: '离职日期格式不正确',
      roleNameRequired: '角色名称必填',
      roleDeleteConfirm: '确定删除该角色？',
      exportMissingColumns: '请先选择要导出的列。',
      exportNoData: '暂无可导出的成员数据。',
      exportFailed: '导出失败，请稍后重试。',
      templateDownloadFailed: '下载模板失败，请稍后重试。',
      importInvalidFile: '无法识别文件，请上传 CSV 或 Excel 文件。',
      importMissingHeaders: '缺少必要字段列：姓名、出生日期。',
      importNoData: '未发现可导入的数据行。',
      importDuplicateUsername: '账号重复（同一文件内）',
      importDuplicateIdentity: '同名同生日匹配多条成员',
      importMemberNotFound: '找不到对应成员（姓名 + 出生日期）',
      importChineseMember: '中国籍成员无需合同变更记录',
      importUsernameExists: '账号已存在',
      importInvalidGender: '性别必须为男或女',
      importInvalidPhone: '电话号码格式不正确',
      importInvalidProject: '项目不存在或无效',
      importInvalidContractType: '合同类型必须为 CTJ 或 CDD',
      importInvalidSalaryUnit: '基础工资单位必须为 MONTH 或 HOUR',
      importInvalidBaseSalaryUnit: 'CDD 合同基础工资只能按月',
      importInvalidStatus: '状态必须为 ACTIVE / ON_LEAVE / TERMINATED',
      importInvalidJoinDate: '入职日期格式不正确',
      importInvalidStartDate: '合同开始日期格式不正确',
      importInvalidEndDate: '合同结束日期格式不正确',
      importInvalidChangeDate: '变更日期格式不正确',
      importMissingBirthDate: '出生日期必填',
      importInvalidBirthDate: '出生日期格式不正确',
      importInvalidChineseSupervisor: '中方负责人账号不存在或非中国籍成员',
      importDuplicateContractNumber: '合同编号重复（同一文件内）',
      importContractNumberExists: '合同编号已存在',
      importMissingTeamSupervisor: '班组未绑定中方负责人',
      importContractChangeMissingFields: '缺少合同变更字段',
      importRoleNotFound: (role: string) => `角色不存在：${role}`,
      importFailed: '导入失败，请稍后重试。',
      baseSalaryUnitInvalid: 'CDD 合同基础工资必须按月填写',
    },
    template: {
      instructionsSheet: '说明',
      columnsHeader: '字段',
      notesHeader: '填写要求与示例',
      notes: {
        name: '必填；姓名或显示名。',
        username: '可选；新建成员需填写，更新留空保留原值；示例：chen.rong',
        password: '可选；新建成员需填写，更新留空保留原值；示例：Temp@1234',
        gender: '仅允许：男 / 女；示例：男',
        nationality: '示例：中国 / 科特迪瓦 / 马里 / 塞内加尔（使用国家名称）',
        phones: '可写多个，用 "/" 分隔；示例：13900001111 / 13800002222',
        tags: '可选；自定义标签，多个用 "/" 或换行分隔。',
        joinDate: '格式：YYYY-MM-DD；示例：2025-01-31',
        birthDate: '必填；格式：YYYY-MM-DD；示例：1990-05-12',
        position: '自由填写，建议统一用词；示例：工程师',
        employmentStatus: '固定值：ACTIVE / ON_LEAVE / TERMINATED；新建留空默认 ACTIVE，更新留空保留原值',
        roles: '仅 role:update / role:manage 可见；填写角色名称，多个用 "/" 分隔；示例：Admin / Employee',
        project: '可选；项目名称或编码。',
        team: '可选；班组或工作组名称。',
        chineseSupervisor: '可选；填写中方负责人账号（username）。',
        contractNumber: '可选；合同编号，需唯一。',
        contractType: '可选；固定值：CTJ / CDD。',
        contractStartDate: '可选；合同开始日期，格式：YYYY-MM-DD。',
        contractEndDate: '可选；合同结束日期，格式：YYYY-MM-DD。',
        salaryCategory: '可选；工资等级/类别。',
        prime: '可选；奖金/补贴金额。',
        baseSalary: '可选；金额+单位，如 83333/M 或 433/H；区间取较大值；CDD 必须按月。',
        netMonthly: '可选；实发工资，仅按月；示例：120000/MOIS net。',
        maritalStatus: '可选；婚姻状态；示例：CELIBATAIRE。',
        childrenCount: '可选；子女数量（整数）。',
        cnpsNumber: '可选；CNPS 号码，支持斜杠分段，自动保留后段数字。',
        cnpsDeclarationCode: '可选；CNPS 申报码，仅数字，OK 忽略。',
        provenance: '可选；籍贯/属地。',
        emergencyContact: '可选；紧急联系人+电话；示例：0170239598 OUMAR FRERE。',
        frenchName: '可选；法语名或法语拼写。',
        idNumber: '可选；身份证号码。',
        passportNumber: '可选；护照号码。',
        educationAndMajor: '可选；毕业院校与专业。',
        certifications: '可选；多个证书用 "/" 或换行分隔。',
        domesticMobile: '可选；国内手机号。',
        emergencyContactName: '可选；紧急联系人姓名。',
        emergencyContactPhone: '可选；紧急联系人电话。',
        redBookValidYears: '可选；红皮书有效年限（整数）。',
        cumulativeAbroadYears: '可选；累计出国年限（整数）。',
        birthplace: '可选；籍贯。',
        residenceInChina: '可选；国内常住地。',
        medicalHistory: '可选；既往病史。',
        healthStatus: '可选；健康状况。',
        terminationDate: '离职时必填；格式：YYYY-MM-DD。',
        terminationReason: '离职时必填；填写离职原因说明。',
      },
    },
    contractChangeTemplate: {
      instructionsSheet: '合同变更说明',
      columnsHeader: '字段',
      notesHeader: '填写要求与示例',
      notes: {
        name: '必填；用于定位成员。',
        birthDate: '必填；格式：YYYY-MM-DD。',
        team: '可选；班组名称。',
        position: '可选；岗位名称；示例：工程师。',
        contractNumber: '可选；合同编号需唯一。',
        contractType: '可选；固定值：CTJ / CDD。',
        salaryCategory: '可选；工资等级。',
        salaryAmount: '可选；基础工资金额。',
        salaryUnit: '可选；MONTH / HOUR（CDD 只能按月）。',
        baseSalary: '可选；金额/单位，如 83333/M（与金额+单位二选一）。',
        prime: '可选；奖金/补贴金额。',
        startDate: '可选；合同开始日期，格式：YYYY-MM-DD，默认变更日期。',
        endDate: '可选；合同结束日期，格式：YYYY-MM-DD，默认开始日期 + 1 年。',
        changeDate: '可选；变更日期，格式：YYYY-MM-DD，默认导入当天。',
        reason: '可选；变更原因。',
        chineseSupervisor: '可选；中方负责人姓名或账号（拼音），必须为中国籍成员。',
      },
    },
    rolePanel: {
      title: '角色管理',
      editTitle: '编辑角色',
      subtitle: '新增角色并绑定需要的权限。',
      namePlaceholder: '请输入角色名称',
      countPrefix: 'RBAC',
      countUnit: '角色',
      members: '成员',
      permissions: '权限',
      primary: '核心职责',
    },
    permissionPanel: {
      title: '权限管理',
      code: '编码',
      description: '描述',
      roles: '关联角色',
      status: '状态',
      edit: '编辑',
      statusLabels: {
        ACTIVE: '启用',
        ARCHIVED: '归档',
      },
      helper: '权限遵循资源-动作编码，可直接复用到 API 鉴权策略。',
    },
    signaturePanel: {
      title: '签名照',
      hint: '上传 PNG/JPG/WebP 签名图片，可用于 PDF 导出。',
      upload: '上传签名',
      uploading: '上传中...',
      current: '当前签名',
      history: '历史版本',
      empty: '暂无签名',
      loading: '加载中...',
      previewAlt: '签名预览',
      viewDenied: '没有签名查看权限',
      setActive: '设为当前',
      activating: '切换中...',
      active: '当前',
      delete: '删除',
      deleting: '删除中...',
      loadError: '加载签名失败',
      uploadFailed: '上传失败',
      activateFailed: '切换失败',
      deleteFailed: '删除失败',
      versionLabel: (version: number) => `版本 ${version}`,
    },
    teamSupervisor: {
      title: '班组负责人',
      subtitle: '维护班组与中方负责人绑定。',
      add: '新增班组',
      team: '班组',
      teamZh: '中文班组',
      supervisor: '中方负责人',
      project: '项目',
      edit: '编辑',
      delete: '删除',
      confirm: '确认',
      cancel: '取消',
      empty: '暂无班组绑定',
      missing: '该班组未绑定中方负责人',
      teamRequired: '班组必填',
      supervisorRequired: '中方负责人必填',
      teamPlaceholder: '输入班组名称',
      teamZhPlaceholder: '输入班组中文名',
      deleteConfirm: (team: string) => `确定删除班组 ${team} 吗？`,
    },
    form: {
      name: '姓名',
      namePlaceholder: '陈蓉 / Marie Dupont',
      username: '账号',
      password: '初始密码',
      passwordPlaceholder: '设置初始密码（编辑留空不改）',
      gender: '性别',
      nationality: '国籍',
      phones: '电话',
      phonePlaceholder: '输入电话',
      addPhone: '添加电话',
      phoneSaved: (count: number) => `已保存 ${count} 个号码`,
      tags: '标签',
      tagsPlaceholder: '多个标签可换行或用 / 分隔',
      joinDate: '入职日期',
      birthDate: '出生日期',
      position: '岗位',
      status: '状态',
      roles: '角色',
      nationalityPlaceholder: '请选择国籍',
      roleName: '角色名称',
      positionPlaceholder: '选择或输入岗位',
      profileSection: '扩展字段',
      profileChinaHint: '中国籍成员可填写中方扩展信息。',
      profileExpatHint: '非中国籍成员可填写当地员工扩展信息。',
      expand: '展开',
      collapse: '收起',
      expatEmpty: '暂无可填写的当地员工扩展字段。',
      team: '班组',
      project: '项目',
      chineseSupervisor: '中方负责人',
      contractNumber: '合同编号',
      contractType: '合同类型',
      contractStartDate: '合同开始日期',
      contractEndDate: '合同结束日期',
      salaryCategory: '工资等级',
      prime: '奖金',
      baseSalary: '基础工资',
      baseSalaryAmount: '基础工资金额',
      baseSalaryUnit: '基础工资单位',
      netMonthly: '实发工资',
      netMonthlyAmount: '实发工资金额',
      netMonthlyUnit: '实发工资单位',
      salaryUnitMonth: '按月',
      salaryUnitHour: '按小时',
      maritalStatus: '婚姻状态',
      childrenCount: '子女数量',
      cnpsNumber: 'CNPS 编号',
      cnpsDeclarationCode: 'CNPS 申报码',
      provenance: '籍贯/属地',
      emergencyContact: '紧急联系人（合并）',
      frenchName: '法语名',
      idNumber: '身份证号',
      passportNumber: '护照号',
      educationAndMajor: '毕业院校与专业',
      certifications: '资格证书',
      certificationsPlaceholder: '多个证书可换行或用 / 分隔',
      domesticMobile: '国内手机号',
      emergencyContactName: '紧急联系人',
      emergencyContactPhone: '紧急联系人电话',
      redBookValidYears: '红皮书有效年限',
      cumulativeAbroadYears: '累计出国年限',
      birthplace: '籍贯',
      residenceInChina: '国内常住地',
      medicalHistory: '既往病史',
      healthStatus: '健康状况',
      terminationDate: '离职日期',
      terminationReason: '离职原因',
      skipChangeHistory: '不记录合同/工资变更历史',
    },
    feedback: {
      loading: '正在加载成员...',
      loadError: '加载失败',
      empty: '暂无成员，试试新增一位。',
      emptyHistory: '暂无记录。',
      submitError: '提交失败',
      deleteConfirm: (username: string) => `确认删除成员 ${username} 吗？`,
      importSuccess: (count: number) => `已成功导入 ${count} 条成员。`,
      importContractChangesSuccess: (count: number) => `已成功导入 ${count} 条合同变更记录。`,
      importRowError: (row: number, message: string) => `第 ${row} 行：${message}`,
      importSkipConfirm: (validCount: number, errorCount: number) =>
        `发现 ${errorCount} 行错误，仍有 ${validCount} 行可导入。是否忽略错误行继续导入？`,
      importPartialSuccess: (imported: number, skipped: number) =>
        `已导入 ${imported} 条，已跳过 ${skipped} 条错误数据。`,
      contractAuditReady: (path: string) => `核对报告已生成：${path || 'reports/'}`,
      bulkSaveSuccess: (count: number) => `已保存 ${count} 条修改。`,
      bulkSavePartial: (success: number, failed: number) =>
        `已保存 ${success} 条，${failed} 条失败。`,
      bulkSaveEmpty: '没有可保存的修改。',
    },
    labels: {
      empty: '无',
      today: '今天',
      close: '关闭',
      cleared: '已清空',
      selectTeam: '选择班组',
      selectMember: '选择成员',
      unsavedTitle: '未保存修改',
      unsavedDescription: '检测到未保存修改，是否保存后切换成员？',
      unsavedBadge: '提醒',
    },
    compensation: {
      title: '合同与薪酬管理',
      contractChanges: '合同变更',
      payrollChanges: '工资变更',
      payrollPayouts: '工资发放',
      addContractChange: '新增合同变更',
      addPayrollChange: '新增工资变更',
      addPayrollPayout: '新增发放记录',
      editContractChange: '编辑合同变更',
      editPayrollChange: '编辑工资变更',
      editPayrollPayout: '编辑发放记录',
      fields: {
        changeDate: '变更日期',
        startDate: '开始日期',
        endDate: '结束日期',
        reason: '变更原因',
        payoutDate: '发放日期',
        amount: '发放金额',
        currency: '币种',
        note: '备注',
        team: '班组',
        chineseSupervisor: '中方负责人',
      },
      actions: {
        save: '保存',
        cancel: '取消',
        edit: '编辑',
        delete: '删除',
        refresh: '刷新',
      },
    },
    payroll: {
      title: '工资发放',
      subtitle: '',
      monthLabel: '发放月份',
      viewModes: {
        entry: '录入',
        report: '报表',
      },
      runLabels: {
        first: '第 1 次',
        second: '第 2 次',
      },
      fields: {
        attendanceCutoffDate: '考勤截止日期',
      },
      actions: {
        useToday: '用今天',
        saveDate: '保存日期',
        saveRun: '保存发放',
        clearRun: '清空记录',
        importPayouts: '导入工资',
        bulkPaste: '批量粘贴',
        applyPaste: '应用',
        clearPaste: '清空',
        exportPdf: '导出工资',
        exportingPdf: '导出中...',
        exportAttendance: '导出考勤表',
        exportingAttendance: '导出考勤中...',
      },
      confirm: {
        clearRun: (label: string) => `确认清空 ${label} 的发放记录吗？此操作不可恢复。`,
      },
      bulkHint: '按当前表格顺序逐行粘贴金额',
      filters: {
        keyword: '姓名/账号',
        includeInactive: '含离职',
      },
      stats: {
        total: '当前筛选',
        ctj: 'CTJ',
        cdd: 'CDD',
      },
      table: {
        runEmpty: '本次不发放',
        total: '合计',
      },
      empty: '暂无可发放成员',
      errors: {
        loadFailed: '加载工资发放失败',
        saveFailed: '保存工资发放失败',
        missingAmount: (count: number) => `仍有 ${count} 人未填写金额`,
        exportFailed: '导出工资失败，请稍后重试。',
        exportAttendanceFailed: '导出考勤表失败，请稍后重试。',
        importInvalidTargets: '没有可用的发放日期',
        importErrorTitle: '导入错误',
        importErrorSummary: (count: number) => `发现 ${count} 条错误，请修正后重试。`,
        importMissingHeaders: '缺少必要字段：合同编号、发放金额',
        importContractNotFound: (contract: string) => `找不到合同编号：${contract}`,
      },
    },
    drawer: {
      tabs: {
        overview: '概览',
        contracts: '合同',
        payroll: '薪资',
      },
      sections: {
        basicInfo: '基本信息',
        contract: '合同信息',
        salary: '薪资信息',
        personal: '个人详情',
        chineseProfile: '中方员工信息',
        emergencyContact: '紧急联系',
      },
      comingSoon: {
        contracts: '合同变更记录功能即将上线',
        payroll: '工资发放请使用成员管理中的“工资发放”模块。',
      },
    },
  },
  fr: {
    title: 'Gestion des membres',
    subtitle:
      'Centralisez les profils, rôles et permissions; imports/exports et traces d’audit intégrées.',
    modalSubtitle: 'Renseignez les champs de base; les extensions sont optionnelles.',
    editTitle: 'Modifier un membre',
    editSubtitle: 'Mettre à jour les informations de base et les champs étendus.',
    breadcrumbs: {
      home: 'Accueil',
      members: 'Gestion des membres',
      memberEdit: 'Modifier le membre',
    },
    tabs: {
      overview: 'Aperçu',
      members: 'Liste des membres',
      roles: 'Gestion des rôles',
      permissions: 'Permissions',
      payroll: 'Versements',
    },
    tabDescriptions: {
      overview: "Vue d'ensemble des effectifs et comparaisons.",
      members: 'Filtrer les membres, importer/exporter et consulter les audits.',
      roles: 'Clarifier les rôles, leurs membres et permissions liées.',
      permissions: 'Consulter chaque permission, sa description et sa couverture.',
      payroll: 'Saisie en lot et reporting mensuel des versements.',
    },
    overview: {
      title: "Vue d'ensemble",
      subtitle: 'Analyse basée sur tous les membres (tous statuts confondus).',
      filters: {
        tagLabel: 'Filtrer par tags projet',
        tagHint: 'Optionnel : filtrer par tags des membres pour comparer.',
      },
      summary: {
        total: 'Effectif total',
        china: 'Chinois',
        nonChina: 'Non chinois',
        local: 'Employés locaux',
      },
      charts: {
        nationality: 'Part Chinois / Non chinois',
        team: 'Analyse des équipes',
        supervisor: 'Top responsables chinois',
        teamCostScatter: 'Carte thermique',
        teamCostShare: 'Concentration des coûts',
        dataQuality: 'Suivi manuel',
        provenance: 'Répartition des provenances',
        salary: 'Répartition des salaires contractuels',
        actualSalary: 'Répartition des salaires versés',
        contractCost: 'Coût par type de contrat',
        position: 'Répartition des postes',
        age: 'Répartition par âge',
        tenure: 'Ancienneté',
        contractExpiry: 'Échéances de contrat (3 mois)',
        detailPayrollTotal: 'Tendance des versements mensuels',
        detailPayrollAverage: 'Tendance du salaire moyen',
        contractTypeTrend: 'Tendance CTJ/CDD',
        salaryPyramid: 'Pyramide salariale',
        payoutRecords: 'Historique des versements',
      },
      labels: {
        total: 'Total',
        people: 'pers.',
        noData: 'Aucune donnée',
        other: 'Autres',
        unassignedTeam: 'Équipe non renseignée',
        unassignedSupervisor: 'Responsable non renseigné',
        missingProvenance: 'Provenance non renseignée',
        missingContractType: 'Type de contrat manquant',
        missingContractDate: 'Date de fin manquante',
        missingPhone: 'Téléphone manquant',
        missingPhoneHint: '0500000000 est compté comme manquant',
        missingCnps: 'N° CNPS manquant',
        missingCnpsWithoutDeclaration: 'N° CNPS manquant et aucun code CNPS',
        expiringSoon: 'Échéances sous 3 mois',
        overdue: 'Déjà expiré',
        beyond: 'Au-delà de 3 mois',
        scopeAll: 'Tous',
        localScope: 'Non chinois',
        china: 'Chinois',
        nonChina: 'Non chinois',
        payrollTotal: 'Total M-1',
        payrollAverage: 'Moyenne',
        payrollMedian: 'Médiane',
        payrollRatio: 'Moy./Méd.',
        teamSortCount: 'Effectif',
        teamSortAvg: 'Moyenne',
        teamSortMedian: 'Méd.',
        modeOverview: 'Vue',
        modeDetail: 'Détail',
        modeCompare: 'Compare',
        scatterHint:
          'Couleur = valeur relative par colonne. Moy./Méd. : plus la valeur est élevée, plus les hauts salaires sont concentrés ; proche de 1, plus la distribution est équilibrée ; trop faible indique une anomalie.',
        missingBirthDate: 'Date de naissance manquante',
        missingPosition: 'Poste manquant',
        positionDetailTitle: 'Détail des postes',
        positionDetailHint: 'Cliquer sur une catégorie pour voir le détail',
        positionDetailClear: 'Réduire',
        detailTeams: 'Sélection des équipes',
        detailTeamsHint: "Cliquer sur une équipe ou un responsable pour analyser",
        ctj: 'CTJ',
        cdd: 'CDD',
        delta: 'Δ vs M-1',
        payoutTotal: 'Total versé',
        dataQualityHint: 'Champs à compléter ou vérifier manuellement',
        compareHint: 'Sélectionnez au moins 2 équipes pour comparer.',
      },
      helpers: {
        salaryRule:
          'Contrat : CTJ converti (22 j × 8 h); NET MENSUEL prioritaire, sinon salaire de base + prime.',
        actualSalaryRule: 'Versements : mois sélectionnés (mi-mois + fin de mois), uniquement les montants versés.',
        actualSalaryRuleDetail:
          'Versements : mois sélectionnés (mi-mois + fin de mois), moyenne mensuelle, uniquement les montants versés.',
        positionRule: 'Postes normalisés par mots-clés, données d’origine intactes.',
      },
      positionGroups: {
        safetyHse: 'Sécurité/HSE',
        labQuality: 'Laboratoire/Qualité',
        plantQuarry: 'Centrale/Concassage/Carrière',
        surveyTopo: 'TOPO',
        maintenance: 'Maintenance/Électricité',
        equipmentOps: 'Opérateurs d’Engins',
        driversTransport: 'Chauffeurs/Transport',
        livingServices: 'Services Généraux',
        warehouseLogistics: 'Magasin/Logistique',
        supervision: 'Encadrement',
        adminSupport: 'Support/Administratif',
        siteWork: 'Travaux/Maçonnerie',
        other: 'Autres/Non Normalisé',
      },
    },
    stats: {
      headcount: 'Effectif',
      active: 'Actifs',
      roles: 'Rôles',
      coverage: 'Couverture permissions',
    },
    helpers: {
      permissionCoverage: 'Permissions',
      permissionFormat:
        'Les permissions suivent le format ressource:action et peuvent être réutilisées côté API.',
    },
    columnSelector: {
      label: 'Colonnes',
      selectAll: 'Tout sélectionner',
      restore: 'Rétablir par défaut',
      clear: 'Tout effacer',
      selectGroup: 'Sélectionner le groupe',
      clearGroup: 'Désélectionner le groupe',
    },
    fieldGroups: {
      basicInfo: 'Informations de base',
      contract: 'Contrat',
      salary: 'Salaire',
      localProfile: 'Profil local',
      chineseProfile: 'Profil chinois',
    },
    filters: {
      title: 'Filtres',
      all: 'Tous',
      selected: (count: number) => `${count} sélectionné(s)`,
      selectAll: 'Tout sélectionner',
      clear: 'Tout effacer',
      reset: 'Effacer les filtres',
      searchPlaceholder: 'Rechercher',
      noOptions: 'Aucune option',
      collapse: 'Réduire',
      expand: 'Développer',
      payrollMonth: 'Mois de paie',
    },
    pagination: {
      summary: (total: number, page: number, totalPages: number) =>
        `Total ${total} · Page ${page} / ${totalPages}`,
      pageSizeLabel: 'Lignes par page',
      prev: 'Précédent',
      next: 'Suivant',
      goTo: 'Aller à la page',
    },
    listHeading: 'Liste des membres',
    status: {
      ACTIVE: 'Actif',
      TERMINATED: 'Sorti',
      ON_LEAVE: 'En congé',
    },
    table: {
      sequence: 'N°',
      name: 'Nom',
      username: 'Identifiant',
      gender: 'Genre',
      nationality: 'Nationalité',
      phones: 'Téléphones',
      joinDate: 'Arrivée',
      birthDate: 'Date de naissance',
      position: 'Poste',
      employmentStatus: 'Statut',
      roles: 'Rôles',
      tags: 'Tags',
      project: 'Projet',
      team: 'Équipe',
      chineseSupervisor: 'Responsable chinois',
      contractNumber: 'N° contrat',
      contractType: 'Type de contrat',
      contractStartDate: 'Début de contrat',
      contractEndDate: 'Fin de contrat',
      salaryCategory: 'Catégorie',
      prime: 'Prime',
      baseSalary: 'Salaire de base',
      netMonthly: 'Net mensuel',
      maritalStatus: 'Statut marital',
      childrenCount: 'Nb enfants',
      cnpsNumber: 'N° CNPS',
      cnpsDeclarationCode: 'Code CNPS',
      provenance: 'Provenance',
      frenchName: 'Nom français',
      idNumber: 'N° identité',
      passportNumber: 'N° passeport',
      educationAndMajor: 'Études / spécialité',
      certifications: 'Certifications',
      domesticMobile: 'Mobile (Chine)',
      emergencyContactName: "Contact d'urgence",
      emergencyContactPhone: "Téléphone d'urgence",
      redBookValidYears: 'Années livret rouge',
      cumulativeAbroadYears: "Années à l'étranger",
      birthplace: "Lieu d'origine",
      residenceInChina: 'Résidence en Chine',
      medicalHistory: 'Antécédents médicaux',
      healthStatus: 'État de santé',
      terminationDate: 'Date de départ',
      terminationReason: 'Motif de départ',
      createdAt: 'Créé le',
      updatedAt: 'Mis à jour',
      actions: 'Actions',
      positionManaged: 'Poste',
      userCount: 'Membres liés',
      created: 'Créé',
      updated: 'Maj',
    },
    actions: {
      create: 'Ajouter un membre',
      import: 'Importer',
      importContractChanges: 'Importer changements de contrat',
      contractAudit: 'Audit contrats',
      export: 'Exporter Excel/CSV',
      template: "Modèle d'import membres",
      contractChangeTemplate: 'Modèle changement de contrat',
      clearSort: 'Réinitialiser le tri',
      search: 'Rechercher',
      saveAndSwitch: 'Enregistrer et changer',
      discardAndSwitch: 'Ignorer et changer',
      auditTrail: "Journal d'audit",
      view: 'Détails',
      edit: 'Éditer',
      delete: 'Supprimer',
      save: 'Enregistrer',
      saveChanges: 'Enregistrer',
      cancel: 'Annuler',
      createRole: 'Ajouter un rôle',
      bulkEdit: 'Modification en lot',
      clearValue: 'Vider',
      teamSupervisors: "Responsables d'équipe",
    },
    access: {
      hint: 'Connectez-vous puis obtenez member:view pour accéder à la liste.',
      needMemberView: 'Droit insuffisant : member:view',
      needRoleView: 'Droit insuffisant : role:view pour afficher les rôles.',
      needPermissionView: 'Droit insuffisant : permission:view pour afficher les permissions.',
      needPayrollView: 'Droit insuffisant : payroll:view',
    },
    errors: {
      needRoleCreate: 'Droit insuffisant : role:create',
      needRoleUpdate: 'Droit insuffisant : role:update',
      needRoleDelete: 'Droit insuffisant : role:delete',
      needMemberCreate: 'Droit insuffisant : member:create',
      needMemberUpdate: 'Droit insuffisant : member:update',
      needMemberDelete: 'Droit insuffisant : member:delete',
      needPermissionUpdate: 'Droit insuffisant : permission:update',
      permissionUpdateFailed: 'Échec de la mise à jour du statut',
      nameRequired: 'Nom requis',
      usernameRequired: "L'identifiant est obligatoire",
      passwordRequired: 'Mot de passe requis',
      birthDateRequired: 'Date de naissance requise',
      birthDateInvalid: 'Format de date de naissance invalide',
      terminationDateRequired: 'Date de départ requise',
      terminationReasonRequired: 'Motif de départ requis',
      terminationDateInvalid: 'Format de date de départ invalide',
      roleNameRequired: 'Nom du rôle requis',
      roleDeleteConfirm: 'Confirmer la suppression du rôle ?',
      exportMissingColumns: 'Sélectionnez au moins une colonne à exporter.',
      exportNoData: 'Aucun membre à exporter.',
      exportFailed: "Échec de l'export, réessayez.",
      templateDownloadFailed: "Échec du téléchargement du modèle, réessayez.",
      importInvalidFile: 'Fichier non reconnu, veuillez fournir un CSV ou Excel.',
      importMissingHeaders: 'Colonnes obligatoires manquantes : Nom, Date de naissance.',
      importNoData: 'Aucune ligne de données à importer.',
      importDuplicateUsername: "Identifiant en double dans le fichier",
      importDuplicateIdentity: 'Plusieurs membres correspondent au même nom et date de naissance',
      importMemberNotFound: 'Membre introuvable (nom + date de naissance)',
      importChineseMember: 'Les membres chinois ne nécessitent pas de changement de contrat',
      importUsernameExists: "Identifiant déjà utilisé",
      importInvalidGender: 'Genre invalide (男 / 女)',
      importInvalidPhone: 'Format de téléphone invalide',
      importInvalidProject: 'Projet introuvable',
      importInvalidContractType: 'Type de contrat invalide (CTJ / CDD)',
      importInvalidSalaryUnit: 'Unité du salaire de base invalide (MONTH / HOUR)',
      importInvalidBaseSalaryUnit: 'Le salaire de base CDD doit être mensuel',
      importInvalidStatus: 'Statut invalide : ACTIVE / ON_LEAVE / TERMINATED',
      importInvalidJoinDate: "Date d'arrivée invalide",
      importInvalidStartDate: 'Date de début de contrat invalide',
      importInvalidEndDate: 'Date de fin de contrat invalide',
      importInvalidChangeDate: 'Date de changement invalide',
      importMissingBirthDate: 'Date de naissance requise',
      importInvalidBirthDate: 'Date de naissance invalide',
      importInvalidChineseSupervisor: 'Identifiant du responsable chinois invalide',
      importDuplicateContractNumber: "N° contrat en double dans le fichier",
      importContractNumberExists: "N° contrat déjà utilisé",
      importMissingTeamSupervisor: "Équipe sans responsable chinois",
      importContractChangeMissingFields: 'Champs de changement de contrat manquants',
      importRoleNotFound: (role: string) => `Rôle introuvable : ${role}`,
      importFailed: "Échec de l'import, réessayez.",
      baseSalaryUnitInvalid: 'Le salaire de base CDD doit être mensuel',
    },
    template: {
      instructionsSheet: 'Instructions',
      columnsHeader: 'Champ',
      notesHeader: 'Règles et exemples',
      notes: {
        name: 'Obligatoire ; nom affiché.',
        username: "Optionnel ; requis à la création, sinon conservé ; ex. chen.rong",
        password: "Optionnel ; requis à la création, sinon conservé ; ex. Temp@1234",
        gender: 'Valeurs : 男 / 女 (Homme / Femme) ; ex. 男',
        nationality: 'Ex. 中国 (Chine) / Côte d’Ivoire / Mali / Sénégal (saisir un nom de pays)',
        phones: 'Plusieurs numéros séparés par "/" ; ex. 13900001111 / 13800002222',
        tags: 'Optionnel ; tags personnalisés, séparés par "/" ou retour ligne.',
        joinDate: 'Format : YYYY-MM-DD ; ex. 2025-01-31',
        birthDate: 'Obligatoire ; format : YYYY-MM-DD ; ex. 1990-05-12',
        position: 'Texte libre, garder une nomenclature cohérente ; ex. Conducteur de travaux',
        employmentStatus:
          'Valeurs fixes : ACTIVE / ON_LEAVE / TERMINATED ; création vide = ACTIVE, sinon conservé',
        roles: 'Visible avec role:update / role:manage ; saisir les noms de rôles, séparés par "/" ; ex. Admin / Employee',
        project: 'Optionnel ; nom ou code du projet.',
        team: 'Optionnel ; équipe ou groupe.',
        chineseSupervisor: 'Optionnel ; identifiant du responsable chinois (username).',
        contractNumber: 'Optionnel ; numéro de contrat, unique.',
        contractType: 'Optionnel ; valeurs : CTJ / CDD.',
        contractStartDate: 'Optionnel ; date de début de contrat (YYYY-MM-DD).',
        contractEndDate: 'Optionnel ; date de fin de contrat (YYYY-MM-DD).',
        salaryCategory: 'Optionnel ; catégorie salariale.',
        prime: 'Optionnel ; montant prime/bonus.',
        baseSalary: 'Optionnel ; montant + unité, ex. 83333/M ou 433/H ; intervalle = valeur max ; CDD = mensuel.',
        netMonthly: 'Optionnel ; net mensuel uniquement ; ex. 120000/MOIS net.',
        maritalStatus: 'Optionnel ; statut marital ; ex. CELIBATAIRE.',
        childrenCount: 'Optionnel ; nombre d’enfants (entier).',
        cnpsNumber: 'Optionnel ; numéro CNPS, segments avec "/", on conserve le dernier.',
        cnpsDeclarationCode: 'Optionnel ; code CNPS, chiffres uniquement, "OK" ignoré.',
        provenance: 'Optionnel ; provenance.',
        emergencyContact: 'Optionnel ; contact + téléphone ; ex. 0170239598 OUMAR FRERE.',
        frenchName: 'Optionnel ; nom en français.',
        idNumber: "Optionnel ; numéro d'identité.",
        passportNumber: 'Optionnel ; numéro de passeport.',
        educationAndMajor: 'Optionnel ; diplôme et spécialité.',
        certifications: 'Optionnel ; plusieurs valeurs séparées par "/" ou retour ligne.',
        domesticMobile: 'Optionnel ; mobile Chine.',
        emergencyContactName: 'Optionnel ; contact d’urgence.',
        emergencyContactPhone: 'Optionnel ; téléphone du contact d’urgence.',
        redBookValidYears: 'Optionnel ; années (entier).',
        cumulativeAbroadYears: 'Optionnel ; années cumulées (entier).',
        birthplace: "Optionnel ; lieu d'origine.",
        residenceInChina: 'Optionnel ; résidence en Chine.',
        medicalHistory: 'Optionnel ; antécédents médicaux.',
        healthStatus: 'Optionnel ; état de santé.',
        terminationDate: 'Obligatoire si départ ; format : YYYY-MM-DD.',
        terminationReason: 'Obligatoire si départ ; indiquer le motif.',
      },
    },
    contractChangeTemplate: {
      instructionsSheet: 'Instructions changement de contrat',
      columnsHeader: 'Champ',
      notesHeader: 'Règles et exemples',
      notes: {
        name: 'Obligatoire ; utilisé pour retrouver le membre.',
        birthDate: 'Obligatoire ; format : YYYY-MM-DD.',
        team: 'Optionnel ; nom de l’équipe.',
        position: 'Optionnel ; poste ; ex. Conducteur de travaux.',
        contractNumber: 'Optionnel ; n° contrat unique.',
        contractType: 'Optionnel ; CTJ / CDD.',
        salaryCategory: 'Optionnel ; catégorie.',
        salaryAmount: 'Optionnel ; montant du salaire de base.',
        salaryUnit: 'Optionnel ; MONTH / HOUR (CDD = mensuel uniquement).',
        baseSalary: 'Optionnel ; montant/unité, ex. 83333/M (au choix avec montant + unité).',
        prime: 'Optionnel ; prime / allocation.',
        startDate: 'Optionnel ; début de contrat (YYYY-MM-DD), défaut = date de changement.',
        endDate: 'Optionnel ; fin de contrat (YYYY-MM-DD), défaut = début + 1 an.',
        changeDate: "Optionnel ; date de changement (YYYY-MM-DD), défaut = aujourd’hui.",
        reason: 'Optionnel ; motif.',
        chineseSupervisor:
          'Optionnel ; nom ou identifiant (pinyin), doit être un membre chinois.',
      },
    },
    rolePanel: {
      title: 'Gestion des rôles',
      editTitle: 'Modifier le rôle',
      subtitle: 'Ajoutez un rôle et associez les permissions nécessaires.',
      namePlaceholder: 'Saisir le nom du rôle',
      countPrefix: 'RBAC',
      countUnit: 'rôles',
      members: 'Membres',
      permissions: 'Permissions',
      primary: 'Responsabilité clé',
    },
    permissionPanel: {
      title: 'Permissions',
      code: 'Code',
      description: 'Description',
      roles: 'Rôles associés',
      status: 'Statut',
      edit: 'Éditer',
      statusLabels: {
        ACTIVE: 'Actif',
        ARCHIVED: 'Archivé',
      },
      helper:
        'Les permissions suivent le format ressource:action et peuvent être réutilisées côté API.',
    },
    signaturePanel: {
      title: 'Signature',
      hint: 'Téléversez une image PNG/JPG/WebP pour la signature (utilisée dans les PDF).',
      upload: 'Téléverser la signature',
      uploading: 'Téléversement...',
      current: 'Signature active',
      history: 'Historique',
      empty: 'Aucune signature',
      loading: 'Chargement...',
      previewAlt: 'Aperçu de la signature',
      viewDenied: 'Accès signature non autorisé',
      setActive: 'Définir active',
      activating: 'Activation...',
      active: 'Active',
      delete: 'Supprimer',
      deleting: 'Suppression...',
      loadError: 'Échec du chargement',
      uploadFailed: 'Échec du téléversement',
      activateFailed: 'Échec de l’activation',
      deleteFailed: 'Échec de la suppression',
      versionLabel: (version: number) => `Version ${version}`,
    },
    teamSupervisor: {
      title: "Responsables d'équipe",
      subtitle: "Lier chaque équipe à un responsable chinois.",
      add: 'Ajouter une équipe',
      team: 'Équipe',
      teamZh: "Équipe (chinois)",
      supervisor: 'Responsable chinois',
      project: 'Projet',
      edit: 'Éditer',
      delete: 'Supprimer',
      confirm: 'Confirmer',
      cancel: 'Annuler',
      empty: "Aucune équipe associée",
      missing: "Cette équipe n'a pas de responsable chinois",
      teamRequired: "L'équipe est obligatoire",
      supervisorRequired: 'Responsable chinois requis',
      teamPlaceholder: "Saisir le nom de l'équipe",
      teamZhPlaceholder: "Saisir le nom chinois de l'équipe",
      deleteConfirm: (team: string) => `Supprimer l'équipe ${team} ?`,
    },
    form: {
      name: 'Nom',
      namePlaceholder: 'Chen Rong / Marie Dupont',
      username: 'Identifiant',
      password: 'Mot de passe initial',
      passwordPlaceholder: 'Définir un mot de passe (vide en édition = inchangé)',
      gender: 'Genre',
      nationality: 'Nationalité',
      phones: 'Téléphone(s)',
      phonePlaceholder: 'Saisir un numéro',
      addPhone: 'Ajouter un numéro',
      phoneSaved: (count: number) => `${count} numéro(s) enregistré(s)`,
      tags: 'Tags',
      tagsPlaceholder: 'Séparer les tags par lignes ou "/"',
      joinDate: "Date d'arrivée",
      birthDate: 'Date de naissance',
      position: 'Poste',
      status: 'Statut',
      roles: 'Rôles',
      nationalityPlaceholder: 'Choisir une nationalité',
      roleName: 'Nom du rôle',
      positionPlaceholder: 'Sélectionner ou saisir',
      profileSection: 'Champs étendus',
      profileChinaHint: 'Champs étendus pour les membres chinois.',
      profileExpatHint: 'Champs étendus pour les employés locaux/non chinois.',
      expand: 'Développer',
      collapse: 'Réduire',
      expatEmpty: 'Aucun champ local à renseigner.',
      team: 'Équipe',
      project: 'Projet',
      chineseSupervisor: 'Responsable chinois',
      contractNumber: 'N° contrat',
      contractType: 'Type de contrat',
      contractStartDate: 'Début de contrat',
      contractEndDate: 'Fin de contrat',
      salaryCategory: 'Catégorie',
      prime: 'Prime',
      baseSalary: 'Salaire de base',
      baseSalaryAmount: 'Montant salaire de base',
      baseSalaryUnit: 'Unité salaire de base',
      netMonthly: 'Net mensuel',
      netMonthlyAmount: 'Montant net mensuel',
      netMonthlyUnit: 'Unité net mensuel',
      salaryUnitMonth: 'Mensuel',
      salaryUnitHour: 'Horaire',
      maritalStatus: 'Statut marital',
      childrenCount: "Nombre d'enfants",
      cnpsNumber: 'N° CNPS',
      cnpsDeclarationCode: 'Code CNPS',
      provenance: 'Provenance',
      emergencyContact: "Contact d'urgence (combiné)",
      frenchName: 'Nom français',
      idNumber: "N° d'identité",
      passportNumber: 'N° de passeport',
      educationAndMajor: 'Études / spécialité',
      certifications: 'Certifications',
      certificationsPlaceholder: 'Séparer par lignes ou "/"',
      domesticMobile: 'Mobile (Chine)',
      emergencyContactName: "Contact d'urgence",
      emergencyContactPhone: "Téléphone d'urgence",
      redBookValidYears: 'Années livret rouge',
      cumulativeAbroadYears: "Années à l'étranger",
      birthplace: "Lieu d'origine",
      residenceInChina: 'Résidence en Chine',
      medicalHistory: 'Antécédents médicaux',
      healthStatus: 'État de santé',
      terminationDate: 'Date de départ',
      terminationReason: 'Motif de départ',
      skipChangeHistory: "Ne pas enregistrer l'historique contrat/salaire",
    },
    feedback: {
      loading: 'Chargement des membres...',
      loadError: 'Échec du chargement',
      empty: 'Aucun membre pour le moment.',
      emptyHistory: 'Aucun enregistrement.',
      submitError: 'Échec de la soumission',
      deleteConfirm: (username: string) => `Supprimer le membre ${username} ?`,
      importSuccess: (count: number) => `Import réussi : ${count} membres.`,
      importContractChangesSuccess: (count: number) =>
        `Import réussi : ${count} changement(s) de contrat.`,
      importRowError: (row: number, message: string) => `Ligne ${row} : ${message}`,
      importSkipConfirm: (validCount: number, errorCount: number) =>
        `${errorCount} lignes en erreur, ${validCount} lignes valides. Ignorer les erreurs et continuer ?`,
      importPartialSuccess: (imported: number, skipped: number) =>
        `Import partiel : ${imported} ok, ${skipped} ignorées.`,
      contractAuditReady: (path: string) => `Rapport créé : ${path || 'reports/'}`,
      bulkSaveSuccess: (count: number) => `${count} modification(s) enregistrée(s).`,
      bulkSavePartial: (success: number, failed: number) =>
        `${success} enregistrée(s), ${failed} échouée(s).`,
      bulkSaveEmpty: 'Aucune modification à enregistrer.',
    },
    labels: {
      empty: 'N/A',
      today: "Aujourd'hui",
      close: 'Fermer',
      cleared: 'Vidé',
      selectTeam: 'Choisir une équipe',
      selectMember: 'Choisir un membre',
      unsavedTitle: 'Modifications non enregistrées',
      unsavedDescription: 'Des changements non enregistrés ont été détectés. Enregistrer avant de changer ?',
      unsavedBadge: 'Alerte',
    },
    compensation: {
      title: 'Contrats et rémunération',
      contractChanges: 'Historique des contrats',
      payrollChanges: 'Historique des salaires',
      payrollPayouts: 'Versements',
      addContractChange: 'Ajouter un contrat',
      addPayrollChange: 'Ajouter un changement',
      addPayrollPayout: 'Ajouter un versement',
      editContractChange: 'Modifier le contrat',
      editPayrollChange: 'Modifier le changement',
      editPayrollPayout: 'Modifier le versement',
      fields: {
        changeDate: 'Date de changement',
        startDate: 'Date de début',
        endDate: 'Date de fin',
        reason: 'Motif',
        payoutDate: 'Date de versement',
        amount: 'Montant',
        currency: 'Devise',
        note: 'Note',
        team: 'Équipe',
        chineseSupervisor: 'Responsable chinois',
      },
      actions: {
        save: 'Enregistrer',
        cancel: 'Annuler',
        edit: 'Éditer',
        delete: 'Supprimer',
        refresh: 'Actualiser',
      },
    },
    payroll: {
      title: 'Versements de salaire',
      subtitle: 'Deux versements mensuels, saisie en lot et rapport.',
      monthLabel: 'Mois de versement',
      viewModes: {
        entry: 'Saisie',
        report: 'Rapport',
      },
      runLabels: {
        first: '1er versement',
        second: '2e versement',
      },
      fields: {
        attendanceCutoffDate: 'Date de clôture de présence',
      },
      actions: {
        useToday: "Aujourd'hui",
        saveDate: 'Enregistrer la date',
        saveRun: 'Enregistrer les montants',
        clearRun: 'Effacer les versements',
        importPayouts: 'Importer Salaires',
        bulkPaste: 'Coller en lot',
        applyPaste: 'Appliquer',
        clearPaste: 'Effacer',
        exportPdf: 'Exporter salaires',
        exportingPdf: 'Export en cours...',
        exportAttendance: 'Exporter la présence',
        exportingAttendance: 'Export des présences...',
      },
      confirm: {
        clearRun: (label: string) =>
          `Effacer les versements du ${label} ? Cette action est irréversible.`,
      },
      bulkHint: 'Une ligne par montant, selon l’ordre du tableau.',
      filters: {
        keyword: 'Nom / identifiant',
        includeInactive: 'Inclure les sortis',
      },
      stats: {
        total: 'Filtre actuel',
        ctj: 'CTJ',
        cdd: 'CDD',
      },
      table: {
        runEmpty: 'Non versé',
        total: 'Total',
      },
      empty: 'Aucun membre à afficher',
      errors: {
        loadFailed: 'Échec du chargement des versements',
        saveFailed: "Échec de l'enregistrement",
        missingAmount: (count: number) => `Montant manquant pour ${count} personne(s)`,
        exportFailed: "Échec de l'export des salaires",
        exportAttendanceFailed: "Échec de l'export des présences",
        importInvalidTargets: 'Aucune date de versement valide',
        importErrorTitle: "Erreurs d'import",
        importErrorSummary: (count: number) =>
          `${count} erreur(s) détectée(s). Corrigez puis réessayez.`,
        importMissingHeaders: 'Colonnes manquantes: N° contrat, Montant',
        importContractNotFound: (contract: string) => `Contrat introuvable : ${contract}`,
      },
    },
    drawer: {
      tabs: {
        overview: 'Aperçu',
        contracts: 'Contrats',
        payroll: 'Paie',
      },
      sections: {
        basicInfo: 'Informations de base',
        contract: 'Contrat',
        salary: 'Salaire',
        personal: 'Détails personnels',
        chineseProfile: 'Profil chinois',
        emergencyContact: "Contact d'urgence",
      },
      comingSoon: {
        contracts: 'Historique des contrats bientôt disponible',
        payroll: 'Utilisez l’onglet Versements dans Gestion des membres.',
      },
    },
  },
}

export const genderOptions: { value: string; label: LocalizedString }[] = [
  { value: '男', label: { zh: '男', fr: 'Homme' } },
  { value: '女', label: { zh: '女', fr: 'Femme' } },
]

export const employmentStatusLabels: Record<Locale, Record<EmploymentStatus, string>> = {
  zh: memberCopy.zh.status,
  fr: memberCopy.fr.status,
}

export const nationalityRegionLabels: Record<Locale, Record<NationalityRegion, string>> = {
  zh: {
    china: '中国',
    'west-africa': '西非',
    'central-africa': '中非',
    'east-africa': '东非',
    'southern-africa': '南部非洲',
  },
  fr: {
    china: 'Chine',
    'west-africa': 'Afrique de l’Ouest',
    'central-africa': 'Afrique centrale',
    'east-africa': 'Afrique de l’Est',
    'southern-africa': 'Afrique australe',
  },
}

export const nationalityOptions: NationalityOption[] = [
  { key: 'china', regions: ['china'], label: { zh: '中国', fr: 'Chine' } },
  // West Africa
  { key: 'cote-divoire', regions: ['west-africa'], label: { zh: '科特迪瓦', fr: "Côte d’Ivoire" } },
  { key: 'senegal', regions: ['west-africa'], label: { zh: '塞内加尔', fr: 'Sénégal' } },
  { key: 'guinea', regions: ['west-africa'], label: { zh: '几内亚', fr: 'Guinée' } },
  { key: 'mali', regions: ['west-africa'], label: { zh: '马里', fr: 'Mali' } },
  { key: 'burkina-faso', regions: ['west-africa'], label: { zh: '布基纳法索', fr: 'Burkina Faso' } },
  { key: 'niger', regions: ['west-africa'], label: { zh: '尼日尔', fr: 'Niger' } },
  { key: 'benin', regions: ['west-africa'], label: { zh: '贝宁', fr: 'Bénin' } },
  { key: 'togo', regions: ['west-africa'], label: { zh: '多哥', fr: 'Togo' } },
  { key: 'mauritania', regions: ['west-africa'], label: { zh: '毛里塔尼亚', fr: 'Mauritanie' } },
  { key: 'cape-verde', regions: ['west-africa'], label: { zh: '佛得角', fr: 'Cap-Vert' } },
  { key: 'ghana', regions: ['west-africa'], label: { zh: '加纳', fr: 'Ghana' } },
  { key: 'gambia', regions: ['west-africa'], label: { zh: '冈比亚', fr: 'Gambie' } },
  // Central Africa
  { key: 'cameroon', regions: ['central-africa'], label: { zh: '喀麦隆', fr: 'Cameroun' } },
  { key: 'chad', regions: ['central-africa'], label: { zh: '乍得', fr: 'Tchad' } },
  {
    key: 'congo-republic',
    regions: ['central-africa', 'southern-africa'],
    label: { zh: '刚果（布）', fr: 'Congo' },
  },
  {
    key: 'congo-drc',
    regions: ['central-africa', 'southern-africa'],
    label: { zh: '刚果（金）', fr: 'RDC' },
  },
  {
    key: 'central-african-republic',
    regions: ['central-africa'],
    label: { zh: '中非共和国', fr: 'Centrafrique' },
  },
  { key: 'gabon', regions: ['central-africa'], label: { zh: '加蓬', fr: 'Gabon' } },
  {
    key: 'equatorial-guinea',
    regions: ['central-africa'],
    label: { zh: '赤道几内亚', fr: 'Guinée équatoriale' },
  },
  { key: 'rwanda', regions: ['central-africa'], label: { zh: '卢旺达', fr: 'Rwanda' } },
  // East Africa
  { key: 'djibouti', regions: ['east-africa'], label: { zh: '吉布提', fr: 'Djibouti' } },
  { key: 'comoros', regions: ['east-africa'], label: { zh: '科摩罗', fr: 'Comores' } },
  { key: 'seychelles', regions: ['east-africa'], label: { zh: '塞舌尔', fr: 'Seychelles' } },
  { key: 'madagascar', regions: ['east-africa'], label: { zh: '马达加斯加', fr: 'Madagascar' } },
  { key: 'mauritius', regions: ['east-africa'], label: { zh: '毛里求斯', fr: 'Maurice' } },
  // Southern Africa
  { key: 'burundi', regions: ['southern-africa'], label: { zh: '布隆迪', fr: 'Burundi' } },
  { key: 'mozambique', regions: ['southern-africa'], label: { zh: '莫桑比克', fr: 'Mozambique' } },
]
