import type { Locale } from './index'

export type DocumentsCopy = {
  nav: {
    title: string
    items: {
      overview: string
      submissions: string
      templates: string
    }
    aria: {
      expand: string
      collapse: string
    }
  }
  breadcrumbs: {
    home: string
    documents: string
    submissions: string
    submissionsNew: string
    submissionDetailWithNumber: string
    submissionDetailFallback: string
    templates: string
    templatesNew: string
    templateDetailFallback: string
  }
  access: {
    hub: string
    submissionsList: string
    submissionCreate: string
    submissionDetail: string
    templatesList: string
    templateCreate: string
    templateDetail: string
  }
  status: {
    document: Record<string, string>
    template: Record<string, string>
  }
  hub: {
    badge: {
      title: string
      accent: string
    }
    title: string
    description: string
    tags: {
      mvp: string
      scope: string
      pdf: string
    }
    quickActions: {
      title: string
      createSubmission: string
      manageTemplates: string
    }
    submissionsCard: {
      label: string
      title: string
      description: string
      cta: string
    }
    templatesCard: {
      label: string
      title: string
      description: string
      cta: string
    }
  }
  submissions: {
    badge: {
      title: string
      suffix: string
    }
    manageTemplates: string
    createSubmission: string
  }
  submissionsFilters: {
    statusLabel: string
    templateLabel: string
    creatorLabel: string
    allLabel: string
    selectAll: string
    clear: string
    submissionNumberLabel: string
    submissionNumberPlaceholder: string
    updatedAtLabel: string
    keywordLabel: string
    keywordPlaceholder: string
    apply: string
    reset: string
  }
  submissionsTable: {
    title: string
    columns: Record<string, string>
    pagination: {
      summary: string
      prev: string
      next: string
      goTo: string
      pageSizeLabel: string
    }
    columnSelector: {
      selectedTemplate: string
      noneSelected: string
      selectAll: string
      restoreDefault: string
      clear: string
    }
    bulkActions: {
      complete: string
      archive: string
      delete: string
    }
    actions: {
      edit: string
      view: string
      export: string
    }
    alerts: {
      noDelete: string
      noEdit: string
      bulkError: string
    }
    aria: {
      selectAll: string
      selectRow: string
    }
    empty: string
  }
  submissionEditor: {
    badge: {
      edit: string
      create: string
    }
    back: string
    tabs: {
      form: string
      preview: string
    }
    baseFields: {
      label: string
      readOnly: string
    }
    template: {
      label: string
      placeholder: string
      titleLabel: string
      titlePlaceholder: string
      statusTemplate: string
      loading: string
    }
    summary: {
      title: string
      fields: {
        projectName: string
        projectCode: string
        contractNumber: string
        recipient: string
        sender: string
      }
      hint: string
    }
    meta: {
      submissionNumber: string
      subject: string
      submissionDate: string
      submissionTime: string
    }
    items: {
      title: string
      add: string
      description: string
      quantity: string
      remark: string
      remove: string
      removeAria: string
    }
    comments: {
      label: string
    }
    inspections: {
      title: string
      hint: string
      searchPlaceholder: string
      searchButton: string
      searchLoading: string
      toggleAll: string
      boundCurrent: string
      boundLabelTemplate: string
      unbound: string
      labels: {
        layer: string
        content: string
        type: string
        appointment: string
        submissionNumber: string
        remark: string
      }
      emptyLoading: string
      empty: string
      selectedCountTemplate: string
      syncHint: string
      ariaSelectTemplate: string
    }
    actions: {
      render: string
      rendering: string
      saveDraft: string
      savingDraft: string
      saveFinal: string
      savingFinal: string
      exportPdf: string
    }
    preview: {
      title: string
      templateLabel: string
      templateEmpty: string
      refresh: string
      exportPdf: string
      emptyHint: string
      frameTitle: string
    }
    baseModal: {
      title: string
      close: string
      fields: {
        projectName: string
        projectCode: string
        contractNumbers: string
        senderTitle: string
        recipientTitle: string
        organization: string
        lastName: string
        firstName: string
        signature: string
        date: string
        time: string
      }
    }
    errors: {
      readOnly: string
      selectTemplate: string
      loadInspections: string
      loadBoundInspections: string
      bindInspections: string
      unbindInspections: string
      loadTemplates: string
    }
    validation: {
      projectName: string
      projectCode: string
      bordereauNumber: string
      subject: string
      senderOrg: string
      recipientOrg: string
      items: string
    }
  }
  templates: {
    badge: {
      title: string
      suffix: string
    }
    backToSubmissions: string
    title: string
    description: string
    create: string
    columns: {
      name: string
      status: string
      version: string
      language: string
      updatedAt: string
      actions: string
    }
    actions: {
      view: string
      edit: string
    }
    empty: string
  }
  templateDetail: {
    badge: string
    statusTemplate: string
    source: {
      file: string
      database: string
    }
    preview: {
      title: string
      readOnly: string
      truncated: string
    }
    placeholders: {
      title: string
      countTemplate: string
      empty: string
      pathTemplate: string
    }
  }
  templateEditForm: {
    title: string
    saved: string
    fields: {
      name: string
      status: string
      version: string
      language: string
      html: string
    }
    save: string
    saving: string
  }
  newTemplateForm: {
    badge: {
      title: string
      suffix: string
    }
    saved: string
    fields: {
      name: string
      status: string
      version: string
      language: string
      html: string
    }
    htmlPlaceholder: string
    save: string
    saving: string
  }
  templateActions: {
    publish: string
    archive: string
  }
}

export const documentsCopy: Record<Locale, DocumentsCopy> = {
  zh: {
    nav: {
      title: '导航',
      items: {
        overview: '概览',
        submissions: '提交单',
        templates: '模版管理',
      },
      aria: {
        expand: '展开导航',
        collapse: '折叠导航',
      },
    },
    breadcrumbs: {
      home: '首页',
      documents: '文档管理',
      submissions: '提交单',
      submissionsNew: '新建提交单',
      submissionDetailWithNumber: '提交单 #{number}',
      submissionDetailFallback: '提交单详情',
      templates: '模版',
      templatesNew: '新建模版',
      templateDetailFallback: '模版详情',
    },
    access: {
      hub: '需要提交单或模板权限才能进入文档管理。',
      submissionsList: '需要提交单查看权限才能查看列表。',
      submissionCreate: '需要提交单新增权限才能创建提交单。',
      submissionDetail: '需要提交单查看权限才能访问详情。',
      templatesList: '需要模板查看权限才能访问模版管理。',
      templateCreate: '需要模板新增权限才能创建模版。',
      templateDetail: '需要模板查看权限才能访问详情。',
    },
    status: {
      document: {
        DRAFT: '草稿',
        FINAL: '完成',
        ARCHIVED: '归档',
      },
      template: {
        DRAFT: '草稿',
        PUBLISHED: '已发布',
        ARCHIVED: '归档',
      },
    },
    hub: {
      badge: {
        title: '文档中心',
        accent: 'Bordereau',
      },
      title: '文档管理',
      description:
        '先完成提交单（Bordereau）的线上填写、模版管理与 PDF 导出；保持字段与报检记录兼容，方便后续扩展函件、会议纪要、物资领用等类型。',
      tags: {
        mvp: 'MVP',
        scope: '模版+提交单',
        pdf: 'PDF 导出',
      },
      quickActions: {
        title: '快速动作',
        createSubmission: '新建提交单',
        manageTemplates: '管理模版',
      },
      submissionsCard: {
        label: '提交单',
        title: '列表 / 创建 / 预览 / PDF',
        description: '状态筛选、搜索、模版选择、实时预览与 PDF 导出；兼顾报检数据的稳定性。',
        cta: '前往提交单 →',
      },
      templatesCard: {
        label: '模版',
        title: 'HTML 模版管理',
        description:
          '维护 `bordereau.html` 与占位符，发布/回滚；发布后用于创建提交单，支持字段自动生成表单。',
        cta: '前往模版管理 →',
      },
    },
    submissions: {
      badge: {
        title: '提交单',
        suffix: '列表/创建',
      },
      manageTemplates: '模版管理 →',
      createSubmission: '新建提交单',
    },
    submissionsFilters: {
      statusLabel: '状态',
      templateLabel: '模版',
      creatorLabel: '创建人',
      allLabel: '全部',
      selectAll: '全选',
      clear: '清空',
      submissionNumberLabel: '提交单编号',
      submissionNumberPlaceholder: '多编号用逗号分隔',
      updatedAtLabel: '更新时间',
      keywordLabel: '关键词',
      keywordPlaceholder: '搜索 code / 标题 / 创建人',
      apply: '应用筛选',
      reset: '重置',
    },
    submissionsTable: {
      title: '提交单',
      columns: {
        code: '编号',
        submissionNumber: '提交单编号',
        rawCode: '原始编号',
        docId: '文档ID',
        status: '状态',
        projectName: '项目名称',
        projectCode: '项目编码',
        contractNumbers: '合同编号',
        bordereauNumber: '清单编号',
        subject: '主题',
        senderOrg: '发件单位',
        senderDate: '提交时间',
        senderLastName: '发件人姓',
        senderFirstName: '发件人名',
        senderTime: '发件时间',
        recipientOrg: '收件单位',
        recipientDate: '收件日期',
        recipientLastName: '收件人姓',
        recipientFirstName: '收件人名',
        recipientTime: '收件时间',
        comments: '提交单备注',
        submissionCreatedAt: '创建时间',
        submissionUpdatedAt: '提交单更新时间',
        designation: '明细',
        quantity: '数量',
        observation: '明细备注',
        itemId: '明细ID',
        itemOrder: '明细序号',
        itemCreatedAt: '明细创建时间',
        itemUpdatedAt: '明细更新时间',
        title: '标题',
        documentType: '单据类型',
        documentRemark: '文档备注',
        documentData: '文档数据',
        documentFiles: '附件',
        documentCreatedAt: '文档创建时间',
        documentUpdatedAt: '文档更新时间',
        templateName: '模板名称',
        templateVersion: '模板版本',
        templateId: '模板ID',
        createdBy: '创建人',
        createdById: '创建人ID',
        updatedBy: '更新人',
        updatedById: '更新人ID',
        action: '操作',
      },
      pagination: {
        summary: '共 {total} 条 · 第 {page}/{totalPages} 页',
        prev: '上一页',
        next: '下一页',
        goTo: '跳转页码',
        pageSizeLabel: '每页条数',
      },
      columnSelector: {
        selectedTemplate: '已选 {count} 列',
        noneSelected: '未选择列',
        selectAll: '全选',
        restoreDefault: '恢复默认',
        clear: '清空',
      },
      bulkActions: {
        complete: '批量完成',
        archive: '批量归档',
        delete: '批量删除',
      },
      actions: {
        edit: '编辑',
        view: '查看',
        export: '导出 PDF',
      },
      alerts: {
        noDelete: '缺少提交单删除权限',
        noEdit: '缺少提交单编辑权限',
        bulkError: '批量操作失败',
      },
      aria: {
        selectAll: '全选',
        selectRow: '选择 {code}',
      },
      empty: '暂无提交单，点击“新建提交单”开始。',
    },
    submissionEditor: {
      badge: {
        edit: '编辑提交单',
        create: '新建提交单',
      },
      back: '返回列表',
      tabs: {
        form: '填写内容',
        preview: '预览 / 导出',
      },
      baseFields: {
        label: '基础字段',
        readOnly: '只读模式',
      },
      template: {
        label: '模版',
        placeholder: '选择模版',
        titleLabel: '标题',
        titlePlaceholder: '可选',
        statusTemplate: '状态：{status}',
        loading: '加载模版中...',
      },
      summary: {
        title: '基础字段摘要',
        fields: {
          projectName: '项目名称',
          projectCode: '项目编码',
          contractNumber: '合同号',
          recipient: '接收方',
          sender: '提交方',
        },
        hint: '以上字段由有提交单管理权限的用户在“基础字段”中编辑。',
      },
      meta: {
        submissionNumber: '提交单编号',
        subject: '主题',
        submissionDate: '提交日期',
        submissionTime: '提交时间',
      },
      items: {
        title: '明细行',
        add: '+ 添加行',
        description: '明细描述',
        quantity: '数量',
        remark: '备注',
        remove: '删除',
        removeAria: '删除明细行',
      },
      comments: {
        label: '备注',
      },
      inspections: {
        title: '关联报检记录',
        hint: '选中后保存会将报检记录绑定到当前提交单，留空则不绑定。',
        searchPlaceholder: '按路段/分项/备注搜索',
        searchButton: '搜索 / 刷新',
        searchLoading: '加载中...',
        toggleAll: '全选/清空',
        boundCurrent: '已绑定当前提交单',
        boundLabelTemplate: '已绑定 {label}',
        unbound: '未绑定',
        labels: {
          layer: '层次',
          content: '内容',
          type: '类型',
          appointment: '预约',
          submissionNumber: '提交单编号',
          remark: '备注',
        },
        emptyLoading: '加载报检记录中...',
        empty: '暂无报检记录，可调整搜索条件后刷新。',
        selectedCountTemplate: '已选择 {count} 条报检记录',
        syncHint: '保存提交单时将同步更新报检绑定关系',
        ariaSelectTemplate: '选择报检 {id}',
      },
      actions: {
        render: '渲染预览',
        rendering: '渲染中...',
        saveDraft: '保存草稿',
        savingDraft: '保存中...',
        saveFinal: '完成并保存',
        savingFinal: '完成中...',
        exportPdf: '导出 PDF',
      },
      preview: {
        title: '预览',
        templateLabel: '模版：',
        templateEmpty: '未选',
        refresh: '刷新预览',
        exportPdf: '导出 PDF',
        emptyHint: '填写表单后点击“刷新预览”查看输出。',
        frameTitle: '提交单预览',
      },
      baseModal: {
        title: '基础字段',
        close: '关闭',
        fields: {
          projectName: '项目名称',
          projectCode: '项目编码',
          contractNumbers: '合同号（用逗号分隔）',
          senderTitle: '提交方',
          recipientTitle: '接收方',
          organization: '组织',
          lastName: '姓',
          firstName: '名',
          signature: '签名（可为图片 URL）',
          date: '日期',
          time: '时间',
        },
      },
      errors: {
        readOnly: '当前为只读模式，无法保存。',
        selectTemplate: '请选择模版',
        loadInspections: '加载报检记录失败',
        loadBoundInspections: '加载已绑定报检失败',
        bindInspections: '绑定报检记录失败',
        unbindInspections: '解绑报检记录失败',
        loadTemplates: '加载模版失败',
      },
      validation: {
        projectName: '项目名称必填',
        projectCode: '项目编码必填',
        bordereauNumber: '编号需为正整数',
        subject: '主题不能为空',
        senderOrg: '提交方组织必填',
        recipientOrg: '接收方组织必填',
        items: '请至少添加一条明细',
      },
    },
    templates: {
      badge: {
        title: '模版',
        suffix: '管理',
      },
      backToSubmissions: '返回提交单 →',
      title: '模版列表',
      description: '维护提交单 HTML 模版，解析占位符并发布后可用于创建。',
      create: '新建模版',
      columns: {
        name: '名称',
        status: '状态',
        version: '版本',
        language: '语言',
        updatedAt: '更新时间',
        actions: '操作',
      },
      actions: {
        view: '查看',
        edit: '编辑',
      },
      empty: '暂无模版，请先创建或运行 seed 脚本。',
    },
    templateDetail: {
      badge: '模版',
      statusTemplate: '状态：{status} · 版本 v{version} · {source}',
      source: {
        file: '来源：文件系统',
        database: '来源：数据库',
      },
      preview: {
        title: 'HTML 预览',
        readOnly: '只读',
        truncated: '…内容过长已截断',
      },
      placeholders: {
        title: '占位符字段',
        countTemplate: '{count} 个',
        empty: '暂无占位符，请检查模版内容。',
        pathTemplate: 'path: {path}',
      },
    },
    templateEditForm: {
      title: '编辑模版',
      saved: '已保存模版',
      fields: {
        name: '名称',
        status: '状态',
        version: '版本',
        language: '语言',
        html: 'HTML（可包含 <style>）',
      },
      save: '保存修改',
      saving: '保存中…',
    },
    newTemplateForm: {
      badge: {
        title: '新建模版',
        suffix: '上传/编辑',
      },
      saved: '模版已保存',
      fields: {
        name: '名称',
        status: '状态',
        version: '版本',
        language: '语言',
        html: 'HTML（可含 <style> CSS）',
      },
      htmlPlaceholder: '在此粘贴包含占位符的 HTML，可内联 <style>CSS</style>',
      save: '保存模版',
      saving: '保存中...',
    },
    templateActions: {
      publish: '发布',
      archive: '归档',
    },
  },
  fr: {
    nav: {
      title: 'Navigation',
      items: {
        overview: 'Aperçu',
        submissions: 'Bordereaux',
        templates: 'Modèles',
      },
      aria: {
        expand: 'Déplier la navigation',
        collapse: 'Replier la navigation',
      },
    },
    breadcrumbs: {
      home: 'Accueil',
      documents: 'Gestion documentaire',
      submissions: 'Bordereaux',
      submissionsNew: 'Nouveau bordereau',
      submissionDetailWithNumber: 'Bordereau n°{number}',
      submissionDetailFallback: 'Détail du bordereau',
      templates: 'Modèles',
      templatesNew: 'Nouveau modèle',
      templateDetailFallback: 'Détail du modèle',
    },
    access: {
      hub: "Les droits bordereau ou modèle sont requis pour accéder à la gestion documentaire.",
      submissionsList: "Le droit de consultation des bordereaux est requis pour voir la liste.",
      submissionCreate: "Le droit de création de bordereaux est requis pour créer un bordereau.",
      submissionDetail: "Le droit de consultation des bordereaux est requis pour voir le détail.",
      templatesList: "Le droit de consultation des modèles est requis pour accéder à la gestion des modèles.",
      templateCreate: "Le droit de création de modèles est requis pour créer un modèle.",
      templateDetail: "Le droit de consultation des modèles est requis pour voir le détail.",
    },
    status: {
      document: {
        DRAFT: 'Brouillon',
        FINAL: 'Finalisé',
        ARCHIVED: 'Archivé',
      },
      template: {
        DRAFT: 'Brouillon',
        PUBLISHED: 'Publié',
        ARCHIVED: 'Archivé',
      },
    },
    hub: {
      badge: {
        title: 'Centre documentaire',
        accent: 'Bordereau',
      },
      title: 'Gestion documentaire',
      description:
        "Saisissez d'abord les bordereaux en ligne, gérez les modèles et exportez en PDF; assurez la compatibilité avec les contrôles pour étendre ensuite aux courriers, comptes rendus ou sorties de matériel.",
      tags: {
        mvp: 'MVP',
        scope: 'Modèles + bordereaux',
        pdf: 'Export PDF',
      },
      quickActions: {
        title: 'Actions rapides',
        createSubmission: 'Nouveau bordereau',
        manageTemplates: 'Gérer les modèles',
      },
      submissionsCard: {
        label: 'Bordereaux',
        title: 'Liste / création / aperçu / PDF',
        description: 'Filtres de statut, recherche, sélection de modèle, aperçu temps réel et export PDF.',
        cta: 'Accéder aux bordereaux →',
      },
      templatesCard: {
        label: 'Modèles',
        title: 'Gestion des modèles HTML',
        description:
          'Maintenez `bordereau.html` et les placeholders; publiez ou restaurez pour alimenter la création.',
        cta: 'Accéder aux modèles →',
      },
    },
    submissions: {
      badge: {
        title: 'Bordereaux',
        suffix: 'Liste / création',
      },
      manageTemplates: 'Gestion des modèles →',
      createSubmission: 'Nouveau bordereau',
    },
    submissionsFilters: {
      statusLabel: 'Statut',
      templateLabel: 'Modèle',
      creatorLabel: 'Créateur',
      allLabel: 'Tous',
      selectAll: 'Tout sélectionner',
      clear: 'Vider',
      submissionNumberLabel: 'N° de bordereau',
      submissionNumberPlaceholder: 'Séparez plusieurs numéros par des virgules',
      updatedAtLabel: 'Mise à jour',
      keywordLabel: 'Mots-clés',
      keywordPlaceholder: 'Rechercher code / titre / créateur',
      apply: 'Appliquer',
      reset: 'Réinitialiser',
    },
    submissionsTable: {
      title: 'Bordereaux',
      columns: {
        code: 'Code',
        submissionNumber: 'N° de bordereau',
        rawCode: 'Code original',
        docId: 'ID document',
        status: 'Statut',
        projectName: 'Nom du projet',
        projectCode: 'Code projet',
        contractNumbers: 'N° contrat',
        bordereauNumber: 'N° de liste',
        subject: 'Objet',
        senderOrg: 'Organisation émettrice',
        senderDate: "Date d'envoi",
        senderLastName: 'Nom expéditeur',
        senderFirstName: 'Prénom expéditeur',
        senderTime: "Heure d'envoi",
        recipientOrg: 'Organisation destinataire',
        recipientDate: 'Date de réception',
        recipientLastName: 'Nom destinataire',
        recipientFirstName: 'Prénom destinataire',
        recipientTime: 'Heure de réception',
        comments: 'Remarque bordereau',
        submissionCreatedAt: 'Créé le',
        submissionUpdatedAt: 'Mise à jour bordereau',
        designation: 'Détail',
        quantity: 'Quantité',
        observation: 'Remarque détail',
        itemId: 'ID détail',
        itemOrder: 'Ordre détail',
        itemCreatedAt: 'Création détail',
        itemUpdatedAt: 'Mise à jour détail',
        title: 'Titre',
        documentType: 'Type de document',
        documentRemark: 'Remarque document',
        documentData: 'Données document',
        documentFiles: 'Pièces jointes',
        documentCreatedAt: 'Création document',
        documentUpdatedAt: 'Mise à jour document',
        templateName: 'Nom du modèle',
        templateVersion: 'Version du modèle',
        templateId: 'ID modèle',
        createdBy: 'Créé par',
        createdById: 'ID créateur',
        updatedBy: 'Mis à jour par',
        updatedById: 'ID modificateur',
        action: 'Actions',
      },
      pagination: {
        summary: '{total} éléments · Page {page}/{totalPages}',
        prev: 'Précédent',
        next: 'Suivant',
        goTo: 'Aller à la page',
        pageSizeLabel: 'Éléments par page',
      },
      columnSelector: {
        selectedTemplate: '{count} colonnes sélectionnées',
        noneSelected: 'Aucune colonne sélectionnée',
        selectAll: 'Tout sélectionner',
        restoreDefault: 'Restaurer par défaut',
        clear: 'Vider',
      },
      bulkActions: {
        complete: 'Finaliser en lot',
        archive: 'Archiver en lot',
        delete: 'Supprimer en lot',
      },
      actions: {
        edit: 'Éditer',
        view: 'Voir',
        export: 'Exporter PDF',
      },
      alerts: {
        noDelete: 'Permission de suppression de bordereau manquante',
        noEdit: "Permission d'édition de bordereau manquante",
        bulkError: "Échec de l'action en masse",
      },
      aria: {
        selectAll: 'Tout sélectionner',
        selectRow: 'Sélectionner {code}',
      },
      empty: 'Aucun bordereau, cliquez sur « Nouveau bordereau » pour commencer.',
    },
    submissionEditor: {
      badge: {
        edit: 'Modifier le bordereau',
        create: 'Nouveau bordereau',
      },
      back: 'Retour à la liste',
      tabs: {
        form: 'Saisie',
        preview: 'Aperçu / export',
      },
      baseFields: {
        label: 'Champs de base',
        readOnly: 'Lecture seule',
      },
      template: {
        label: 'Modèle',
        placeholder: 'Choisir un modèle',
        titleLabel: 'Titre',
        titlePlaceholder: 'Optionnel',
        statusTemplate: 'Statut : {status}',
        loading: 'Chargement des modèles...',
      },
      summary: {
        title: 'Résumé des champs de base',
        fields: {
          projectName: 'Nom du projet',
          projectCode: 'Code projet',
          contractNumber: 'N° de contrat',
          recipient: 'Destinataire',
          sender: 'Expéditeur',
        },
        hint: 'Ces champs sont modifiables dans « Champs de base » avec la permission de gestion des bordereaux.',
      },
      meta: {
        submissionNumber: 'N° de bordereau',
        subject: 'Objet',
        submissionDate: "Date d'envoi",
        submissionTime: "Heure d'envoi",
      },
      items: {
        title: 'Lignes de détail',
        add: '+ Ajouter une ligne',
        description: 'Description',
        quantity: 'Quantité',
        remark: 'Remarque',
        remove: 'Supprimer',
        removeAria: 'Supprimer la ligne',
      },
      comments: {
        label: 'Remarques',
      },
      inspections: {
        title: 'Associer des contrôles',
        hint: 'Les contrôles sélectionnés seront liés au bordereau lors de la sauvegarde.',
        searchPlaceholder: 'Rechercher par route/phase/remarque',
        searchButton: 'Rechercher / Actualiser',
        searchLoading: 'Chargement...',
        toggleAll: 'Tout sélectionner / vider',
        boundCurrent: 'Lié au bordereau courant',
        boundLabelTemplate: 'Lié {label}',
        unbound: 'Non lié',
        labels: {
          layer: 'Couche',
          content: 'Contenu',
          type: 'Type',
          appointment: 'Rendez-vous',
          submissionNumber: 'N° de bordereau',
          remark: 'Remarque',
        },
        emptyLoading: 'Chargement des contrôles...',
        empty: 'Aucun contrôle, ajustez la recherche puis actualisez.',
        selectedCountTemplate: '{count} contrôles sélectionnés',
        syncHint: 'Les liaisons seront mises à jour lors de la sauvegarde du bordereau',
        ariaSelectTemplate: 'Sélectionner le contrôle {id}',
      },
      actions: {
        render: "Générer l'aperçu",
        rendering: 'Génération...',
        saveDraft: 'Enregistrer le brouillon',
        savingDraft: 'Enregistrement...',
        saveFinal: 'Finaliser et enregistrer',
        savingFinal: 'Finalisation...',
        exportPdf: 'Exporter PDF',
      },
      preview: {
        title: 'Aperçu',
        templateLabel: 'Modèle :',
        templateEmpty: 'Non sélectionné',
        refresh: "Actualiser l'aperçu",
        exportPdf: 'Exporter PDF',
        emptyHint: 'Remplissez le formulaire puis cliquez sur « Actualiser l’aperçu ».',
        frameTitle: 'apercu-bordereau',
      },
      baseModal: {
        title: 'Champs de base',
        close: 'Fermer',
        fields: {
          projectName: 'Nom du projet',
          projectCode: 'Code projet',
          contractNumbers: 'N° de contrat (séparés par des virgules)',
          senderTitle: 'Expéditeur',
          recipientTitle: 'Destinataire',
          organization: 'Organisation',
          lastName: 'Nom',
          firstName: 'Prénom',
          signature: 'Signature (URL image possible)',
          date: 'Date',
          time: 'Heure',
        },
      },
      errors: {
        readOnly: 'Mode lecture seule: impossible d’enregistrer.',
        selectTemplate: 'Veuillez choisir un modèle.',
        loadInspections: 'Impossible de charger les contrôles.',
        loadBoundInspections: 'Impossible de charger les contrôles liés.',
        bindInspections: 'Échec de liaison des contrôles.',
        unbindInspections: 'Échec de déliaison des contrôles.',
        loadTemplates: 'Impossible de charger les modèles.',
      },
      validation: {
        projectName: 'Le nom du projet est requis.',
        projectCode: 'Le code projet est requis.',
        bordereauNumber: 'Le numéro doit être un entier positif.',
        subject: "L'objet est requis.",
        senderOrg: "L'organisation de l'expéditeur est requise.",
        recipientOrg: "L'organisation du destinataire est requise.",
        items: 'Ajoutez au moins une ligne.',
      },
    },
    templates: {
      badge: {
        title: 'Modèles',
        suffix: 'Gestion',
      },
      backToSubmissions: 'Retour aux bordereaux →',
      title: 'Liste des modèles',
      description: 'Gérez les modèles HTML des bordereaux et publiez-les pour la création.',
      create: 'Nouveau modèle',
      columns: {
        name: 'Nom',
        status: 'Statut',
        version: 'Version',
        language: 'Langue',
        updatedAt: 'Mise à jour',
        actions: 'Actions',
      },
      actions: {
        view: 'Voir',
        edit: 'Éditer',
      },
      empty: 'Aucun modèle pour le moment; créez-en un ou lancez le script seed.',
    },
    templateDetail: {
      badge: 'Modèle',
      statusTemplate: 'Statut : {status} · Version v{version} · {source}',
      source: {
        file: 'Source : système de fichiers',
        database: 'Source : base de données',
      },
      preview: {
        title: 'Aperçu HTML',
        readOnly: 'Lecture seule',
        truncated: '…contenu tronqué',
      },
      placeholders: {
        title: 'Champs de remplacement',
        countTemplate: '{count} éléments',
        empty: 'Aucun placeholder, vérifiez le contenu du modèle.',
        pathTemplate: 'chemin : {path}',
      },
    },
    templateEditForm: {
      title: 'Modifier le modèle',
      saved: 'Modèle enregistré',
      fields: {
        name: 'Nom',
        status: 'Statut',
        version: 'Version',
        language: 'Langue',
        html: 'HTML (peut inclure <style>)',
      },
      save: 'Enregistrer les modifications',
      saving: 'Enregistrement…',
    },
    newTemplateForm: {
      badge: {
        title: 'Nouveau modèle',
        suffix: 'Importer / éditer',
      },
      saved: 'Modèle enregistré',
      fields: {
        name: 'Nom',
        status: 'Statut',
        version: 'Version',
        language: 'Langue',
        html: 'HTML (avec <style> CSS)',
      },
      htmlPlaceholder: 'Collez ici le HTML avec placeholders, <style> CSS en ligne possible.',
      save: 'Enregistrer le modèle',
      saving: 'Enregistrement...',
    },
    templateActions: {
      publish: 'Publier',
      archive: 'Archiver',
    },
  },
}

export const getDocumentsCopy = (locale: Locale): DocumentsCopy => documentsCopy[locale]
