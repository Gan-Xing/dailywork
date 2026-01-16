import type { Locale } from './index'

export type DocumentsCopy = {
  nav: {
    title: string
    items: {
      overview: string
      files: string
      submissions: string
      templates: string
      letters: string
    }
    aria: {
      expand: string
      collapse: string
    }
  }
  breadcrumbs: {
    home: string
    documents: string
    files: string
    submissions: string
    submissionsNew: string
    submissionDetailWithNumber: string
    submissionDetailFallback: string
    letters: string
    lettersNew: string
    letterDetailFallback: string
    templates: string
    templatesNew: string
    templateDetailFallback: string
  }
  access: {
    hub: string
    submissionsList: string
    submissionCreate: string
    submissionDetail: string
    lettersList: string
    letterCreate: string
    letterDetail: string
    filesList: string
    templatesList: string
    templateCreate: string
    templateDetail: string
  }
  status: {
    document: Record<string, string>
    template: Record<string, string>
  }
  documentType?: Record<string, string>
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
      createLetter: string
      manageTemplates: string
      manageFiles: string
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
    filesCard: {
      label: string
      title: string
      description: string
      cta: string
    }
    lettersCard: {
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
  letters: {
    title: string
    description: string
    create: string
    filters: {
      searchLabel: string
      searchPlaceholder: string
      statusLabel: string
      projectLabel: string
      allLabel: string
    }
    table: {
      code: string
      subject: string
      recipient: string
      project: string
      status: string
      updatedAt: string
      attachments: string
      actions: string
      empty: string
    }
    form: {
      newTitle: string
      editTitle: string
      project: string
      code: string
      codeHint: string
      subject: string
      senderOrg: string
      senderName: string
      recipientOrg: string
      recipientName: string
      issuedAt: string
      receivedAt: string
      status: string
      content: string
      remark: string
      attachments: string
      upload: string
      save: string
      cancel: string
      delete: string
    }
    messages: {
      loadError: string
      loading: string
      saving: string
      saved: string
      requiredProject: string
      requiredSubject: string
      deleteConfirm: string
      deleteSuccess: string
      uploadFailed: string
      attachmentsEmpty: string
    }
    actions: {
      edit: string
      view: string
      delete: string
    }
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
  files: {
    badge: {
      title: string
      suffix: string
    }
    title: string
    description: string
    uploadPanel: {
      title: string
      helper: string
      hint: string
      categoryLabel: string
      categoryPlaceholder: string
      fileLabel: string
      dropTitle: string
      dropSubtitle: string
      dropAction: string
      dropHint: string
      selectedLabel: string
      selectedCount: string
      selectedMore: string
      linkTitle: string
      linkHint: string
      entityType: string
      entityId: string
      purpose: string
      label: string
      upload: string
      uploading: string
      reset: string
      cameraAction: string
      albumAction: string
      entityTypes: Record<string, string>
      purposes: Record<string, string>
      purposePlaceholder: string
    }
    dropdown: {
      selected: string
      selectAll: string
      clear: string
      search: string
      all: string
    }
    filters: {
      title: string
      categoryLabel: string
      entityTypeLabel: string
      entityIdLabel: string
      dateFromLabel: string
      dateToLabel: string
      keywordLabel: string
      keywordPlaceholder: string
      allLabel: string
      apply: string
      reset: string
    }
    table: {
      title: string
      columns: {
        file: string
        category: string
        links: string
        owner: string
        createdBy: string
        createdAt: string
        actions: string
      }
      actions: {
        open: string
        delete: string
        edit: string
        download: string
      }
      badges: {
        linked: string
        signature: string
      }
      empty: string
      deleteConfirm: string
      deleteBlocked: string
    }
    editDialog: {
      title: string
      nameLabel: string
      linksTitle: string
      linksEmpty: string
      addLinkTitle: string
      addLinkAction: string
      removeLinkAction: string
      save: string
      saving: string
      cancel: string
      success: string
      failed: string
    }
    pagination: {
      summary: string
      prev: string
      next: string
      goTo: string
      pageSizeLabel: string
    }
    categories: Record<string, string>
    messages: {
      uploadFailed: string
      openFailed: string
      deleteFailed: string
      missingCategory: string
      missingFile: string
      invalidLink: string
      boqItemSearchHint: string
      boqItemLoadFailed: string
    }
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
      exporting: string
    }
    preview: {
      title: string
      templateLabel: string
      templateEmpty: string
      refresh: string
      exportPdf: string
      exporting: string
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
      type: string
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
    typeLabel: string
  }
  templateEditForm: {
    title: string
    saved: string
    fields: {
      name: string
      type: string
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
      type: string
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
        files: '文件管理',
        submissions: '提交单',
        templates: '模版管理',
        letters: '函件',
      },
      aria: {
        expand: '展开导航',
        collapse: '折叠导航',
      },
    },
    breadcrumbs: {
      home: '首页',
      documents: '文档管理',
      files: '文件管理',
      submissions: '提交单',
      submissionsNew: '新建提交单',
      submissionDetailWithNumber: '提交单 #{number}',
      submissionDetailFallback: '提交单详情',
      letters: '函件',
      lettersNew: '新建函件',
      letterDetailFallback: '函件详情',
      templates: '模版',
      templatesNew: '新建模版',
      templateDetailFallback: '模版详情',
    },
    access: {
      hub: '需要提交单、模板或文件权限才能进入文档管理。',
      submissionsList: '需要提交单查看权限才能查看列表。',
      submissionCreate: '需要提交单新增权限才能创建提交单。',
      submissionDetail: '需要提交单查看权限才能访问详情。',
      lettersList: '需要函件查看权限才能查看列表。',
      letterCreate: '需要函件新增权限才能创建函件。',
      letterDetail: '需要函件查看权限才能访问详情。',
      filesList: '需要文件查看权限才能访问文件管理。',
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
    documentType: {
      SUBMISSION: '提交单',
      LETTER: '函件',
      MINUTES: '会议纪要',
      SUPPLY_REQUEST: '物资申请',
      DAILY_REPORT: '日报',
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
        createLetter: '新建函件',
        manageTemplates: '管理模版',
        manageFiles: '管理文件',
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
      filesCard: {
        label: '文件',
        title: '非结构化文件管理',
        description: '集中查看签名、报检材料、签到表等文件，支持检索与在线打开。',
        cta: '前往文件管理 →',
      },
      lettersCard: {
        label: '函件',
        title: '函件记录与附件',
        description: '记录函件收发信息、编号与正文，集中管理函件附件。',
        cta: '前往函件 →',
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
    letters: {
      title: '函件管理',
      description: '记录函件收发信息、编号与正文，支持附件上传。',
      create: '新建函件',
      filters: {
        searchLabel: '检索',
        searchPlaceholder: '搜索编号/主题/收件方',
        statusLabel: '状态',
        projectLabel: '项目',
        allLabel: '全部',
      },
      table: {
        code: '函件编号',
        subject: '主题',
        recipient: '收件方',
        project: '项目',
        status: '状态',
        updatedAt: '更新时间',
        attachments: '附件',
        actions: '操作',
        empty: '暂无函件记录',
      },
      form: {
        newTitle: '新建函件',
        editTitle: '函件详情',
        project: '项目',
        code: '函件编号',
        codeHint: '留空自动生成，格式如 N°001/2025/DG/BDK/CRBC',
        subject: '主题',
        senderOrg: '发函单位',
        senderName: '发函人',
        recipientOrg: '收函单位',
        recipientName: '收函人',
        issuedAt: '发函日期',
        receivedAt: '签收日期',
        status: '状态',
        content: '函件内容',
        remark: '备注',
        attachments: '函件附件',
        upload: '上传附件',
        save: '保存',
        cancel: '取消',
        delete: '删除',
      },
      messages: {
        loadError: '加载失败，请稍后重试',
        loading: '正在加载…',
        saving: '正在保存…',
        saved: '保存成功',
        requiredProject: '请选择项目',
        requiredSubject: '请填写函件主题',
        deleteConfirm: '确认删除该函件？',
        deleteSuccess: '已删除函件',
        uploadFailed: '附件上传失败',
        attachmentsEmpty: '暂无附件',
      },
      actions: {
        edit: '编辑',
        view: '查看',
        delete: '删除',
      },
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
    files: {
      badge: {
        title: '文件',
        suffix: '列表/上传',
      },
      title: '文件管理',
      description: '集中管理签名、报检材料、签到表等非结构化文件，支持分类、关联与在线打开。',
      uploadPanel: {
        title: '上传新文件',
        helper: '上传后可在文件管理中查询，并支持在业务模块中关联使用。',
        hint: '提示：对象类型/ID 可留空，留空即不关联。',
        categoryLabel: '文件分类',
        categoryPlaceholder: '请选择分类',
        fileLabel: '选择文件',
        dropTitle: '拖拽文件到此处',
        dropSubtitle: '或点击选择文件',
        dropAction: '浏览文件',
        dropHint: '支持批量上传',
        selectedLabel: '已选择',
        selectedCount: '{count} 个文件',
        selectedMore: '还有 {count} 个文件',
        linkTitle: '关联信息（可选）',
        linkHint: '仅需绑定特定数据时填写。',
        entityType: '关联分类',
        entityId: '关联对象',
        purpose: '用途',
        label: '展示名',
        upload: '开始上传',
        uploading: '上传中...',
        reset: '清空',
        cameraAction: '拍照',
        albumAction: '从相册选择',
        entityTypes: {
          user: '项目成员 (User)',
          inspection: '报检单 (Inspection)',
          submission: '提交单 (Submission)',
          'actual-boq-item': '工程内容',
          other: '其他 (Other)',
        },
        purposes: {
          signature: '签名 (signature)',
          avatar: '头像 (avatar)',
          attachment: '附件 (attachment)',
        },
        purposePlaceholder: '选择或输入用途',
      },
      dropdown: {
        selected: '{count} 已选',
        selectAll: '全选',
        clear: '清空',
        search: '搜索...',
        all: '请选择',
      },
      filters: {
        title: '筛选条件',
        categoryLabel: '分类',
        entityTypeLabel: '关联分类',
        entityIdLabel: '关联对象',
        dateFromLabel: '开始日期',
        dateToLabel: '结束日期',
        keywordLabel: '关键词',
        keywordPlaceholder: '搜索文件名 / 上传人 / 关联信息',
        allLabel: '全部',
        apply: '应用筛选',
        reset: '重置',
      },
      table: {
        title: '文件列表',
        columns: {
          file: '文件',
          category: '分类',
          links: '关联',
          owner: '所属成员',
          createdBy: '上传人',
          createdAt: '上传时间',
          actions: '操作',
        },
        actions: {
          open: '打开',
          delete: '删除',
          edit: '编辑',
          download: '下载',
        },
        badges: {
          linked: '已关联',
          signature: '签名',
        },
        empty: '暂无文件',
        deleteConfirm: '确认删除该文件？',
        deleteBlocked: '文件已被引用，无法删除。',
      },
      editDialog: {
        title: '编辑文件',
        nameLabel: '文件名',
        linksTitle: '已绑定关系',
        linksEmpty: '暂无绑定',
        addLinkTitle: '新增绑定',
        addLinkAction: '添加绑定',
        removeLinkAction: '解绑',
        cancel: '取消',
        save: '保存',
        saving: '保存中...',
        success: '保存成功',
        failed: '保存失败',
      },
      pagination: {
        summary: '共 {total} 条，第 {page}/{totalPages} 页',
        prev: '上一页',
        next: '下一页',
        goTo: '跳转页码',
        pageSizeLabel: '每页',
      },
      categories: {
        signature: '签名',
        'inspection-receipt': '报检单签收版',
        'inspection-acceptance': '报检验收材料',
        'attendance-sheet': '签到表',
        'letter-receipt': '函件签收件',
        'face-photo': '人脸照片',
        'site-photo': '现场照片',
        attachment: '附件',
        other: '其他',
      },
      messages: {
        uploadFailed: '上传失败',
        openFailed: '打开失败',
        deleteFailed: '删除失败',
        missingCategory: '请选择文件分类',
        missingFile: '请选择文件',
        invalidLink: '对象类型与对象 ID 必须同时填写',
        boqItemSearchHint: '输入关键词搜索工程内容',
        boqItemLoadFailed: '工程内容加载失败',
      },
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
        exporting: '导出中...',
      },
      preview: {
        title: '预览',
        templateLabel: '模版：',
        templateEmpty: '未选',
        refresh: '刷新预览',
        exportPdf: '导出 PDF',
        exporting: '导出中...',
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
        type: '类型',
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
      typeLabel: '类型：{type}',
    },
    templateEditForm: {
      title: '编辑模版',
      saved: '已保存模版',
      fields: {
        name: '名称',
        type: '类型',
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
        type: '类型',
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
        files: 'Fichiers',
        submissions: 'Bordereaux',
        templates: 'Modèles',
        letters: 'Courriers',
      },
      aria: {
        expand: 'Déplier la navigation',
        collapse: 'Replier la navigation',
      },
    },
    breadcrumbs: {
      home: 'Accueil',
      documents: 'Gestion documentaire',
      files: 'Fichiers',
      submissions: 'Bordereaux',
      submissionsNew: 'Nouveau bordereau',
      submissionDetailWithNumber: 'Bordereau n°{number}',
      submissionDetailFallback: 'Détail du bordereau',
      letters: 'Courriers',
      lettersNew: 'Nouveau courrier',
      letterDetailFallback: 'Détail du courrier',
      templates: 'Modèles',
      templatesNew: 'Nouveau modèle',
      templateDetailFallback: 'Détail du modèle',
    },
    access: {
      hub: "Les droits bordereau, modèle ou fichier sont requis pour accéder à la gestion documentaire.",
      submissionsList: "Le droit de consultation des bordereaux est requis pour voir la liste.",
      submissionCreate: "Le droit de création de bordereaux est requis pour créer un bordereau.",
      submissionDetail: "Le droit de consultation des bordereaux est requis pour voir le détail.",
      lettersList: "Le droit de consultation des courriers est requis pour voir la liste.",
      letterCreate: "Le droit de création de courriers est requis pour créer un courrier.",
      letterDetail: "Le droit de consultation des courriers est requis pour voir le détail.",
      filesList: "Le droit de consultation des fichiers est requis pour accéder à la gestion des fichiers.",
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
    documentType: {
      SUBMISSION: 'Bordereau',
      LETTER: 'Courrier',
      MINUTES: 'Compte rendu',
      SUPPLY_REQUEST: 'Demande matériel',
      DAILY_REPORT: 'Rapport journalier',
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
        createLetter: 'Nouveau courrier',
        manageTemplates: 'Gérer les modèles',
        manageFiles: 'Gérer les fichiers',
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
      filesCard: {
        label: 'Fichiers',
        title: 'Gestion centralisée des fichiers',
        description: "Consultez signatures, pièces d'acceptation, feuilles de présence et autres fichiers.",
        cta: 'Accéder aux fichiers →',
      },
      lettersCard: {
        label: 'Courriers',
        title: 'Gestion des courriers',
        description: 'Suivi des informations de réception, du numéro et du contenu.',
        cta: 'Accéder aux courriers →',
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
    letters: {
      title: 'Gestion des courriers',
      description: 'Enregistrez les informations, le numéro et le contenu du courrier.',
      create: 'Nouveau courrier',
      filters: {
        searchLabel: 'Recherche',
        searchPlaceholder: 'Rechercher par numéro / objet / destinataire',
        statusLabel: 'Statut',
        projectLabel: 'Projet',
        allLabel: 'Tous',
      },
      table: {
        code: 'N° courrier',
        subject: 'Objet',
        recipient: 'Destinataire',
        project: 'Projet',
        status: 'Statut',
        updatedAt: 'Mise à jour',
        attachments: 'Pièces',
        actions: 'Actions',
        empty: 'Aucun courrier',
      },
      form: {
        newTitle: 'Nouveau courrier',
        editTitle: 'Détail du courrier',
        project: 'Projet',
        code: 'N° courrier',
        codeHint: 'Laissez vide pour générer (ex: N°001/2025/DG/BDK/CRBC)',
        subject: 'Objet',
        senderOrg: 'Organisation émettrice',
        senderName: 'Nom émetteur',
        recipientOrg: 'Organisation destinataire',
        recipientName: 'Nom destinataire',
        issuedAt: 'Date émission',
        receivedAt: 'Date réception',
        status: 'Statut',
        content: 'Contenu',
        remark: 'Remarque',
        attachments: 'Pièces jointes',
        upload: 'Téléverser',
        save: 'Enregistrer',
        cancel: 'Annuler',
        delete: 'Supprimer',
      },
      messages: {
        loadError: 'Chargement impossible',
        loading: 'Chargement…',
        saving: 'Enregistrement…',
        saved: 'Enregistré',
        requiredProject: 'Sélectionner un projet',
        requiredSubject: 'Objet requis',
        deleteConfirm: 'Supprimer ce courrier ?',
        deleteSuccess: 'Courrier supprimé',
        uploadFailed: 'Téléversement échoué',
        attachmentsEmpty: 'Aucune pièce jointe',
      },
      actions: {
        edit: 'Modifier',
        view: 'Voir',
        delete: 'Supprimer',
      },
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
    files: {
      badge: {
        title: 'Fichiers',
        suffix: 'Liste / téléversement',
      },
      title: 'Gestion des fichiers',
      description: "Centralisez signatures, pièces d'acceptation, feuilles de présence et autres fichiers.",
      uploadPanel: {
        title: 'Téléverser un fichier',
        helper: 'Le fichier sera disponible dans la gestion des fichiers et peut être lié aux modules.',
        hint: "Astuce : laissez le type/ID vide pour ne pas associer.",
        categoryLabel: 'Catégorie',
        categoryPlaceholder: 'Choisir une catégorie',
        fileLabel: 'Fichier',
        dropTitle: 'Glissez-déposez le fichier ici',
        dropSubtitle: 'ou cliquez pour choisir',
        dropAction: 'Parcourir',
        dropHint: 'Téléversement multiple pris en charge',
        selectedLabel: 'Sélectionné',
        selectedCount: '{count} fichier(s)',
        selectedMore: '+{count} autres fichiers',
        linkTitle: 'Association (optionnel)',
        linkHint: 'Remplir pour lier à une donnée.',
        entityType: 'Catégorie de liaison',
        entityId: 'Objet lié',
        purpose: 'Usage',
        label: 'Libellé',
        upload: 'Téléverser',
        uploading: 'Téléversement...',
        reset: 'Réinitialiser',
        cameraAction: 'Prendre une photo',
        albumAction: 'Choisir depuis l’album',
        entityTypes: {
          user: 'Membre (User)',
          inspection: 'Inspection',
          submission: 'Bordereau (Submission)',
          'actual-boq-item': 'BoqItem',
          other: 'Autre',
        },
        purposes: {
          signature: 'Signature',
          avatar: 'Avatar',
          attachment: 'Pièce jointe',
        },
        purposePlaceholder: 'Choisir ou saisir usage',
      },
      dropdown: {
        selected: '{count} sélectionné(s)',
        selectAll: 'Tout',
        clear: 'Vider',
        search: 'Rechercher...',
        all: 'Choisir',
      },
      filters: {
        title: 'Filtres',
        categoryLabel: 'Catégorie',
        entityTypeLabel: 'Catégorie de liaison',
        entityIdLabel: 'Objet lié',
        dateFromLabel: 'Date début',
        dateToLabel: 'Date fin',
        keywordLabel: 'Mots-clés',
        keywordPlaceholder: 'Nom / auteur / association',
        allLabel: 'Tous',
        apply: 'Appliquer',
        reset: 'Réinitialiser',
      },
      table: {
        title: 'Liste des fichiers',
        columns: {
          file: 'Fichier',
          category: 'Catégorie',
          links: 'Associations',
          owner: 'Membre',
          createdBy: 'Téléversé par',
          createdAt: 'Date',
          actions: 'Actions',
        },
        actions: {
          open: 'Ouvrir',
          delete: 'Supprimer',
          edit: 'Éditer',
          download: 'Télécharger',
        },
        badges: {
          linked: 'Lié',
          signature: 'Signature',
        },
        empty: 'Aucun fichier',
        deleteConfirm: 'Supprimer ce fichier ?',
        deleteBlocked: 'Fichier déjà référencé, suppression impossible.',
      },
      editDialog: {
        title: 'Éditer le fichier',
        nameLabel: 'Nom du fichier',
        linksTitle: 'Liens existants',
        linksEmpty: 'Aucun lien',
        addLinkTitle: 'Ajouter un lien',
        addLinkAction: 'Ajouter',
        removeLinkAction: 'Détacher',
        cancel: 'Annuler',
        save: 'Enregistrer',
        saving: 'Enregistrement...',
        success: 'Enregistré avec succès',
        failed: 'Échec de l’enregistrement',
      },
      pagination: {
        summary: '{total} éléments, page {page}/{totalPages}',
        prev: 'Précédent',
        next: 'Suivant',
        goTo: 'Aller à la page',
        pageSizeLabel: 'Par page',
      },
      categories: {
        signature: 'Signature',
        'inspection-receipt': 'Accusé de réception',
        'inspection-acceptance': "Pièces d'acceptation",
        'attendance-sheet': 'Feuille de présence',
        'letter-receipt': 'Réception de courrier',
        'face-photo': 'Photo visage',
        'site-photo': 'Photo de chantier',
        attachment: 'Pièce jointe',
        other: 'Autre',
      },
      messages: {
        uploadFailed: 'Échec du téléversement',
        openFailed: "Échec de l'ouverture",
        deleteFailed: 'Échec de la suppression',
        missingCategory: 'Veuillez choisir une catégorie',
        missingFile: 'Veuillez choisir un fichier',
        invalidLink: 'Type et ID doivent être renseignés ensemble',
        boqItemSearchHint: 'Saisissez un mot-clé pour rechercher',
        boqItemLoadFailed: 'Chargement des BoqItem impossible',
      },
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
        exporting: 'Exportation...',
      },
      preview: {
        title: 'Aperçu',
        templateLabel: 'Modèle :',
        templateEmpty: 'Non sélectionné',
        refresh: "Actualiser l'aperçu",
        exportPdf: 'Exporter PDF',
        exporting: 'Exportation...',
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
        type: 'Type',
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
      typeLabel: 'Type : {type}',
    },
    templateEditForm: {
      title: 'Modifier le modèle',
      saved: 'Modèle enregistré',
      fields: {
        name: 'Nom',
        type: 'Type',
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
        type: 'Type',
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
