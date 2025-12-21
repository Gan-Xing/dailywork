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
    tabs: Record<'members' | 'roles' | 'permissions', string>
    tabDescriptions: Record<'members' | 'roles' | 'permissions', string>
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
      | 'position'
      | 'employmentStatus'
      | 'roles'
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
      export: string
      template: string
      clearSort: string
      auditTrail: string
      view: string
      edit: string
      delete: string
      save: string
      saveChanges: string
      cancel: string
      createRole: string
    }
    access: {
      hint: string
      needMemberView: string
      needRoleView: string
      needPermissionView: string
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
      usernameRequired: string
      passwordRequired: string
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
      importUsernameExists: string
      importInvalidGender: string
      importInvalidPhone: string
      importInvalidStatus: string
      importInvalidJoinDate: string
      importRoleNotFound: (role: string) => string
      importFailed: string
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
        | 'joinDate'
        | 'position'
        | 'employmentStatus'
        | 'roles'
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
        | 'healthStatus',
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
    form: {
      name: string
      username: string
      password: string
      passwordPlaceholder: string
      gender: string
      nationality: string
      phones: string
      phonePlaceholder: string
      addPhone: string
      joinDate: string
      position: string
      status: string
      roles: string
      nationalityPlaceholder: string
      roleName: string
      positionPlaceholder: string
      profileSection: string
      profileChinaHint: string
      profileExpatHint: string
      expand: string
      collapse: string
      expatEmpty: string
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
    }
    feedback: {
      loading: string
      loadError: string
      empty: string
      submitError: string
      deleteConfirm: (username: string) => string
      importSuccess: (count: number) => string
      importRowError: (row: number, message: string) => string
      importSkipConfirm: (validCount: number, errorCount: number) => string
      importPartialSuccess: (imported: number, skipped: number) => string
    }
    labels: {
      empty: string
      today: string
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
      members: '成员列表',
      roles: '角色管理',
      permissions: '权限管理',
    },
    tabDescriptions: {
      members: '筛选成员、导入导出与审计记录视图。',
      roles: '梳理角色职责并查看成员覆盖与权限绑定。',
      permissions: '审视权限编码、描述与角色覆盖范围。',
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
      position: '岗位',
      employmentStatus: '状态',
      roles: '角色',
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
      export: '导出 Excel/CSV',
      template: '下载模板',
      clearSort: '清空排序',
      auditTrail: '审计日志',
      view: '详情',
      edit: '编辑',
      delete: '删除',
      save: '保存',
      saveChanges: '保存修改',
      cancel: '取消',
      createRole: '新增角色',
    },
    access: {
      hint: '请先登录并开通 member:view 权限后再试。',
      needMemberView: '缺少 member:view 权限，无法查看成员列表。',
      needRoleView: '缺少 role:view 权限，无法查看角色列表。',
      needPermissionView: '缺少 permission:view 权限，无法查看权限列表。',
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
      usernameRequired: '账号必填',
      passwordRequired: '初始密码必填',
      roleNameRequired: '角色名称必填',
      roleDeleteConfirm: '确定删除该角色？',
      exportMissingColumns: '请先选择要导出的列。',
      exportNoData: '暂无可导出的成员数据。',
      exportFailed: '导出失败，请稍后重试。',
      templateDownloadFailed: '下载模板失败，请稍后重试。',
      importInvalidFile: '无法识别文件，请上传 CSV 或 Excel 文件。',
      importMissingHeaders: '缺少必要字段列：账号、初始密码。',
      importNoData: '未发现可导入的数据行。',
      importDuplicateUsername: '账号重复（同一文件内）',
      importUsernameExists: '账号已存在',
      importInvalidGender: '性别必须为男或女',
      importInvalidPhone: '电话号码格式不正确',
      importInvalidStatus: '状态必须为 ACTIVE / ON_LEAVE / TERMINATED',
      importInvalidJoinDate: '入职日期格式不正确',
      importRoleNotFound: (role: string) => `角色不存在：${role}`,
      importFailed: '导入失败，请稍后重试。',
    },
    template: {
      instructionsSheet: '说明',
      columnsHeader: '字段',
      notesHeader: '填写要求与示例',
      notes: {
        name: '可选；姓名或显示名。',
        username: '必填且唯一；示例：chen.rong',
        password: '新建必填；示例：Temp@1234',
        gender: '仅允许：男 / 女；示例：男',
        nationality: '示例：中国 / 科特迪瓦 / 马里 / 塞内加尔（使用国家名称）',
        phones: '可写多个，用 "/" 分隔；示例：13900001111 / 13800002222',
        joinDate: '格式：YYYY-MM-DD；示例：2025-01-31',
        position: '自由填写，建议统一用词；示例：工程师',
        employmentStatus: '固定值：ACTIVE / ON_LEAVE / TERMINATED；留空默认 ACTIVE',
        roles: '仅 role:update / role:manage 可见；填写角色名称，多个用 "/" 分隔；示例：Admin / Employee',
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
    form: {
      name: '姓名',
      username: '账号',
      password: '初始密码',
      passwordPlaceholder: '设置初始密码（编辑留空不改）',
      gender: '性别',
      nationality: '国籍',
      phones: '电话',
      phonePlaceholder: '输入电话',
      addPhone: '添加电话',
      joinDate: '入职日期',
      position: '岗位',
      status: '状态',
      roles: '角色',
      nationalityPlaceholder: '请选择国籍',
      roleName: '角色名称',
      positionPlaceholder: '选择或输入岗位',
      profileSection: '扩展字段',
      profileChinaHint: '中国籍成员可填写中方扩展信息。',
      profileExpatHint: '非中国籍成员暂未配置扩展字段。',
      expand: '展开',
      collapse: '收起',
      expatEmpty: '外籍/当地员工扩展字段暂未配置。',
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
    },
    feedback: {
      loading: '正在加载成员...',
      loadError: '加载失败',
      empty: '暂无成员，试试新增一位。',
      submitError: '提交失败',
      deleteConfirm: (username: string) => `确认删除成员 ${username} 吗？`,
      importSuccess: (count: number) => `已成功导入 ${count} 条成员。`,
      importRowError: (row: number, message: string) => `第 ${row} 行：${message}`,
      importSkipConfirm: (validCount: number, errorCount: number) =>
        `发现 ${errorCount} 行错误，仍有 ${validCount} 行可导入。是否忽略错误行继续导入？`,
      importPartialSuccess: (imported: number, skipped: number) =>
        `已导入 ${imported} 条，已跳过 ${skipped} 条错误数据。`,
    },
    labels: {
      empty: '无',
      today: '今天',
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
      members: 'Liste des membres',
      roles: 'Gestion des rôles',
      permissions: 'Permissions',
    },
    tabDescriptions: {
      members: 'Filtrer les membres, importer/exporter et consulter les audits.',
      roles: 'Clarifier les rôles, leurs membres et permissions liées.',
      permissions: 'Consulter chaque permission, sa description et sa couverture.',
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
      position: 'Poste',
      employmentStatus: 'Statut',
      roles: 'Rôles',
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
      export: 'Exporter Excel/CSV',
      template: 'Télécharger le modèle',
      clearSort: 'Réinitialiser le tri',
      auditTrail: "Journal d'audit",
      view: 'Détails',
      edit: 'Éditer',
      delete: 'Supprimer',
      save: 'Enregistrer',
      saveChanges: 'Enregistrer',
      cancel: 'Annuler',
      createRole: 'Ajouter un rôle',
    },
    access: {
      hint: 'Connectez-vous puis obtenez member:view pour accéder à la liste.',
      needMemberView: 'Droit insuffisant : member:view',
      needRoleView: 'Droit insuffisant : role:view pour afficher les rôles.',
      needPermissionView: 'Droit insuffisant : permission:view pour afficher les permissions.',
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
      usernameRequired: "L'identifiant est obligatoire",
      passwordRequired: 'Mot de passe requis',
      roleNameRequired: 'Nom du rôle requis',
      roleDeleteConfirm: 'Confirmer la suppression du rôle ?',
      exportMissingColumns: 'Sélectionnez au moins une colonne à exporter.',
      exportNoData: 'Aucun membre à exporter.',
      exportFailed: "Échec de l'export, réessayez.",
      templateDownloadFailed: "Échec du téléchargement du modèle, réessayez.",
      importInvalidFile: 'Fichier non reconnu, veuillez fournir un CSV ou Excel.',
      importMissingHeaders: 'Colonnes obligatoires manquantes : Identifiant, Mot de passe initial.',
      importNoData: 'Aucune ligne de données à importer.',
      importDuplicateUsername: "Identifiant en double dans le fichier",
      importUsernameExists: "Identifiant déjà utilisé",
      importInvalidGender: 'Genre invalide (男 / 女)',
      importInvalidPhone: 'Format de téléphone invalide',
      importInvalidStatus: 'Statut invalide : ACTIVE / ON_LEAVE / TERMINATED',
      importInvalidJoinDate: "Date d'arrivée invalide",
      importRoleNotFound: (role: string) => `Rôle introuvable : ${role}`,
      importFailed: "Échec de l'import, réessayez.",
    },
    template: {
      instructionsSheet: 'Instructions',
      columnsHeader: 'Champ',
      notesHeader: 'Règles et exemples',
      notes: {
        name: 'Optionnel ; nom affiché.',
        username: 'Obligatoire et unique ; ex. chen.rong',
        password: 'Obligatoire à la création ; ex. Temp@1234',
        gender: 'Valeurs : 男 / 女 (Homme / Femme) ; ex. 男',
        nationality: 'Ex. 中国 (Chine) / Côte d’Ivoire / Mali / Sénégal (saisir un nom de pays)',
        phones: 'Plusieurs numéros séparés par "/" ; ex. 13900001111 / 13800002222',
        joinDate: 'Format : YYYY-MM-DD ; ex. 2025-01-31',
        position: 'Texte libre, garder une nomenclature cohérente ; ex. Conducteur de travaux',
        employmentStatus: 'Valeurs fixes : ACTIVE / ON_LEAVE / TERMINATED ; vide = ACTIVE',
        roles: 'Visible avec role:update / role:manage ; saisir les noms de rôles, séparés par "/" ; ex. Admin / Employee',
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
    form: {
      name: 'Nom',
      username: 'Identifiant',
      password: 'Mot de passe initial',
      passwordPlaceholder: 'Définir un mot de passe (vide en édition = inchangé)',
      gender: 'Genre',
      nationality: 'Nationalité',
      phones: 'Téléphone(s)',
      phonePlaceholder: 'Saisir un numéro',
      addPhone: 'Ajouter un numéro',
      joinDate: "Date d'arrivée",
      position: 'Poste',
      status: 'Statut',
      roles: 'Rôles',
      nationalityPlaceholder: 'Choisir une nationalité',
      roleName: 'Nom du rôle',
      positionPlaceholder: 'Sélectionner ou saisir',
      profileSection: 'Champs étendus',
      profileChinaHint: 'Champs étendus pour les membres chinois.',
      profileExpatHint: 'Aucun champ étendu défini pour les non-chinois.',
      expand: 'Développer',
      collapse: 'Réduire',
      expatEmpty: 'Aucun champ étendu défini pour les employés locaux/étrangers.',
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
    },
    feedback: {
      loading: 'Chargement des membres...',
      loadError: 'Échec du chargement',
      empty: 'Aucun membre pour le moment.',
      submitError: 'Échec de la soumission',
      deleteConfirm: (username: string) => `Supprimer le membre ${username} ?`,
      importSuccess: (count: number) => `Import réussi : ${count} membres.`,
      importRowError: (row: number, message: string) => `Ligne ${row} : ${message}`,
      importSkipConfirm: (validCount: number, errorCount: number) =>
        `${errorCount} lignes en erreur, ${validCount} lignes valides. Ignorer les erreurs et continuer ?`,
      importPartialSuccess: (imported: number, skipped: number) =>
        `Import partiel : ${imported} ok, ${skipped} ignorées.`,
    },
    labels: {
      empty: 'N/A',
      today: "Aujourd'hui",
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
