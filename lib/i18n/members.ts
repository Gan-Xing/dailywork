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
    breadcrumbs: {
      home: string
      members: string
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
      needMemberViewRoles: string
      needPermissionView: string
    }
    errors: {
      needRoleManage: string
      needMemberManage: string
      needMemberEdit: string
      usernameRequired: string
      passwordRequired: string
      roleNameRequired: string
      roleDeleteConfirm: string
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
    }
    feedback: {
      loading: string
      loadError: string
      empty: string
      submitError: string
      deleteConfirm: (username: string) => string
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
    modalSubtitle: '录入共享字段，扩展资料后续在详情页维护。',
    breadcrumbs: {
      home: '首页',
      members: '成员管理',
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
      needMemberViewRoles: '缺少 member:view 权限，无法查看角色列表。',
      needPermissionView: '缺少 permission:view 权限，无法查看权限列表。',
    },
    errors: {
      needRoleManage: '权限不足：role:manage',
      needMemberManage: '缺少成员管理权限',
      needMemberEdit: '缺少成员编辑权限',
      usernameRequired: '账号必填',
      passwordRequired: '初始密码必填',
      roleNameRequired: '角色名称必填',
      roleDeleteConfirm: '确定删除该角色？',
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
    },
    feedback: {
      loading: '正在加载成员...',
      loadError: '加载失败',
      empty: '暂无成员，试试新增一位。',
      submitError: '提交失败',
      deleteConfirm: (username: string) => `确认删除成员 ${username} 吗？`,
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
    modalSubtitle: 'Renseignez les champs communs; les détails avancés pourront suivre.',
    breadcrumbs: {
      home: 'Accueil',
      members: 'Gestion des membres',
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
      needMemberViewRoles: 'Droit insuffisant : member:view pour afficher les rôles.',
      needPermissionView: 'Droit insuffisant : permission:view pour afficher les permissions.',
    },
    errors: {
      needRoleManage: 'Droit insuffisant : role:manage',
      needMemberManage: 'Droit insuffisant : member:manage',
      needMemberEdit: 'Droit insuffisant : member:edit',
      usernameRequired: "L'identifiant est obligatoire",
      passwordRequired: 'Mot de passe requis',
      roleNameRequired: 'Nom du rôle requis',
      roleDeleteConfirm: 'Confirmer la suppression du rôle ?',
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
    },
    feedback: {
      loading: 'Chargement des membres...',
      loadError: 'Échec du chargement',
      empty: 'Aucun membre pour le moment.',
      submitError: 'Échec de la soumission',
      deleteConfirm: (username: string) => `Supprimer le membre ${username} ?`,
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
