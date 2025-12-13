# 日报字段整理

## 气象条件（Condition météorologique）

- **用途**：记录当天 7h30、12h30、17h30 三个固定时段的天气状况与降雨量。
- **字段**
     1. `Période`：枚举，取值为 `7h30`、`12h30`、`17h30`。
     2. `Condition météorologique`：分类字段，必须从 `E (Ensoleillé)`、`C (Couvert)`、`B (Brouillard)`、`P (Pluie)` 中选择，默认选项为 `E (Ensoleillé)`（晴）。
     3. `Pluviométrie (mm)`：降雨量，单位毫米，可为小数，无降雨填 `0`。

## 工地工时（Horaires du chantier）

- **用途**：记录当日施工时间及可能的停工原因。
- **字段**
     1. `Horaires`：默认值 `7H à 12H / 13H à 17H`，如无特殊情况无需修改。
     2. `Arrêt & Cause`：可选文本字段，仅在存在停工时记录原因，默认留空。

## 日志标题信息

- **用途**：确定日报所属月度与具体日期。
- **字段**
     1. `Année du journal`：下拉选择，仅提供 `2025`、`2026` 两个候选，必填。
     2. `Journal de chantier du mois de`：下拉选择 12 个月（Janvier–Décembre，对应 1–12 月），必填。
     3. `Date`：日期字段（示例 `07/11/2025`），必填。

## 页眉标识（Logos et entités）

- **用途**：展示固定的四个机构标识，不需要动态输入。
- **组件**
     1. `MINISTERE DE L'EQUIPEMENT ET DE L'ENTRETIEN ROUTIER (MEER)`：固定 Logo。
     2. `Maitre d'ouvrage délégué`：固定 Logo。
     3. `Maitre d'œuvre`：固定 Logo。
     4. `Entrepreneur`：固定 Logo。

## 工程名称（Nom du chantier）

- **内容**：固定文本区域，显示
  `TRAVAUX DE RENFORCEMENT DE LA ROUTE BONDOUKOU - BOUNA Y COMPRIS L'AMENAGEMENT DES TRAVERSEES DE BOUNA, BONDOUKOU ET AGNIBILEKROU (MARCHE 2024 - 0 - 11 - 00 - 2 - 0560/-330)`
- **说明**：无需输入，始终展示上述内容。

## Matériel sur le chantier

- **结构**：表格包含四列——`Désignation`（占两列，包含分类及设备清单）、`Total`、`Marche`、`Panne`、`Arrêt`。
- **用途**：逐项记录各类设备在场数量及运行状态（正常/故障/停用）。
- **默认值**：每个设备行的 `Total`、`Marche`、`Panne`、`Arrêt` 读取自 `lib/data/equipment-defaults.json`（若无条目则回退为 `0`），现场可直接覆盖修改。
- **分类与明细**
     - `Camion` 1. Camion benne 4x2 2. Camion benne 6x4 3. Camion benne 8x4 4. Camion semi-remorque 5. Citerne à eau / Pulvérulent 6. Entretien / Ravitailleur Go 7. Plateau / Hyab 8. Rem. Plateau / Porte-chars / Porteur 9. Rem. 10. Répandeuse liant 11. Epandeur ciment 12. Toupie 13. Tracteur routier
     - `Compacteur` 1. Double bille 2. Monobille 3. Pied de mouton 4. Rouleaux à pneu 5. à timon
     - `Engins` 1. Bulldozers 2. Chargeurs 3. Tractopelle 4. Extrudeuse 5. Finisseur 6. Foreuse 7. Niveleuses 8. Pelle à chenille et pneu 9. Recycleuse / Malaxeuse / Raboteuse 10. Tracteur agricole / Balayeuse
     - `Industrie` 1. Centrale à béton 2. Concasseur / Reconstitution 3. Poste d'enrobage 4. Fluxage / Emulsion
     - `Levage` 1. Elevateur à fourche + BOBCAT 2. Grue mobile
     - `Logistique` 1. Bus / Camion personnel 2. Camionnette 3. Ambulance 4. Véhicule léger
     - `Matériels et accessoires` 1. Autre matériel 2. BRH / Pinces demol / Caisson / Bras 3. Compresseur 4. TC / Stations / Centrifugeuses / Potabilisation 5. Cuve à gasoil / Bitume 6. Bétonnière 7. Gravillonneur porté 8. Bitucontainer / Brûleur 9. Brûleur 10. Elargisseur accotement 11. Groupe électrogène 12. Motopompe 13. Poste de soudure 14. Pesage - Pont bascule / Pèse essieux
- **总计**：第二列共有 52 个设备条目（请核对：13 + 5 + 10 + 4 + 2 + 4 + 14）。
- **汇总**：需在表格底部提供 `TOTAL` 行，对每列（`Total`、`Marche`、`Panne`、`Arrêt`）的数量求和。

## Approvisionnement en matériaux

- **用途**：追踪关键材料的库存变化，展示上期库存、入库、出库和最新库存，帮助工地掌握物料保障情况。
- **结构**：表格包含列 `Désignation`、`Stock Préc.`（上期库存）、`Entrée`、`Sortie`、`Nouveau Stock`，所有数值字段支持小数。
- **材料列表**
     1. `Gasoil (l)`
     2. `Essence (l)`
     3. `Bitumes (t)`
     4. `Ciment (t)`
     5. `Fer à béton (t)`
     6. `GNT 0/31,5 (m³)`
     7. `Sable (t)`
     8. `Gravillons (t)`
     9. `Explosifs (t)`
- **自动逻辑**
     1. `Nouveau Stock` 由系统实时计算：`Stock Préc.` + `Entrée` - `Sortie`，界面禁用人工输入。
     2. 新建日报时，系统会回溯最近一份已保存的日报，将其中每种材料的 `Nouveau Stock` 作为本次的 `Stock Préc.` 初值（若没有历史记录则为 `0`）。
     3. 修改历史日报会触发级联回算：从被修改日期起，依次刷新后续日报的 `Stock Préc.` 与 `Nouveau Stock`，确保库存链条连贯。
- **说明**：各材料单位不同，不进行列级汇总。

## Personnel sur le chantier

- **用途**：在统一表格中记录管理层与一线岗位的到岗/缺勤人数，直观反映每日人力配置。
- **结构**：单张表包含列 `Fonction`、`Présent`、`Absent`，所有值为非负整数。
- **岗位列表（管理与支持）**
     1. Directeur de Projet
     2. Directeurs Technique
     3. Directeurs de Travaux
     4. Resp. Admin. et Compt
     5. Ingénieur planning + Ingénieur travaux
     6. Cond. de travaux
     7. Resp. Contrôle qualité
     8. Resp. Topo / BE
     9. Resp. Laboratoire
     10. Resp. Carrière / Industries
     11. Resp. Atelier
     12. Resp HSE
     13. Agent Administratif
     14. Médecins + Ambulanciers
     15. Equipe HSE (Resp Adjt + aides)
     16. Equipe qualité (Resp Adjt + Relais qualité)
     17. Chef de Chantier
- **岗位列表（现场与外协）**
     1. Chef d'Equipe
     2. Pointeurs / Pointeaux
     3. Conducteurs d'engins
     4. Chauffeurs de camion
     5. Chauffeurs de voiture
     6. Ouvriers + manœuvres
     7. Mécaniciens
     8. Equipe labo (Adjt + opérateur + aides)
     9. Equipe topo (Adjt + opérateur + aides)
     10. Cuisiniers / serveurs / femmes de ménage
     11. Soutraitants
     12. Surêté
     13. Equipe Sureté
- **统计行**：表尾包含 `TOTAL` 行汇总在岗/缺勤总计，随后单独一行 `Dont Expatrié` 用于记录外派人数（若无需统计上岗数可仅填写缺勤列），帮助区分本地与外派人力。

## Observations sûreté & environnement

- **Sûreté**：大块富文本区域，用于记录当日安全巡查、门禁及巡逻情况；允许空白，若无事件需填写“RAS”以保留留痕。
- **Environnement**：与 Sûreté 区域宽度一致的多行文本，记录环境保护、扬尘、噪音、水土措施执行情况；支持粘贴监测数据或整改计划。
- **Constatations**：自由文本区域，用于记录现场总体观察、进度异常或质量隐患；鼓励引用具体工点或编号，方便追踪。
- **Evènements particuliers**：专门记录事故、临时封路、重要来访等特殊事件；留足空间填写事件描述、时间、负责人及即时处理结果。若当日无事项可留空或写“无”。

## Travaux exécutés

- **用途**：提供逐类的大幅文本区域，详述当天完成的主要工序、产量、工点及资源投入。若某类无任务可保持空白或写“无”。
- **呈现**：每个模块以标题 + 多行富文本形式呈现，允许插入列表、测量数据或位置描述。
- **模块列表**
     1. `Préparation`
     2. `Terrassement`
     3. `Chaussee`
     4. `Assainissement`
     5. `Sécurité et Signalisation`
     6. `Géotechnique / Essais de laboratoire`
     7. `Divers`
- **记录建议**：在每个区块内注明工点（PK、结构物名称）、完成量、动用设备/人员以及存在的问题。无内容时无需占位文本，保持区域空白即可。

## Contrôles

- **用途**：记录当天完成的内部/外部检查、试验与验收，包括时间、责任人、结果与整改要求。
- **格式**：大块富文本区域，可附带量测数据或引用附件编号；若无检查活动可留空或写“RAS”。

## BE / Topographie

- **用途**：由设计院（BE）或测量组填写放样、复测、形变监测、断面测量等成果。
- **格式**：富文本，可插入坐标、PK、断面图描述等，支持粘贴表格编号或图纸引用。

## Carrière

- **用途**：描述采石场、取料基地或工业产线的生产、库存、运输与质量情况，以及潜在风险。
- **格式**：多行文本，可记录产量、发运批次、问题及处理措施。

## Travaux sous-traités

- **用途**：概述外包单位当天执行的任务、完成量、协调事项与待解决问题。
- **格式**：富文本，可列出分包商名称、作业面位置、进度比对等信息。

## Observations / Divers

- **用途**：补充以上区域未覆盖的其他信息，例如突发事件、资源调配、临时指令或备注。
- **格式**：自由文本，支持列表或段落；若无内容可留空。

## 道路进度元数据（RoadSection）

- **用途**：由管理员维护道路起终点信息，作为报检与分项工程配置的归属入口。
- **字段**
     0. `slug`：路由标识（仅小写字母/数字/连字符，唯一），创建时指定，用于路段详情 URL，例如 `bondoukou-university`。
     1. `name`：路段名称，文本，必填。
     2. `startPk`：起点标识，文本，支持 `PK0+000` 或交叉口描述，必填。
     3. `endPk`：终点标识，文本，必填。
     4. `createdAt` / `updatedAt`：系统维护的时间戳，用于审计与排序。

## 分项定义（PhaseDefinition）

- **用途**：全局的分项模板库，用于跨道路复用分项名称、展示方式及默认的层次/验收内容。
- **字段**
     0. `id`：唯一标识（自增或 UUID）。
     1. `name`：分项名称（如“土方”），与 `measure` 组合唯一，必填。
     2. `measure`：枚举 `LINEAR` / `POINT`，必填。
     3. `pointHasSides`：布尔，仅对 `POINT` 有意义；为 `true` 时单体分项在展示/报检时按左右侧分别呈现，默认 `false`（单行展示）。
     3. `defaultLayers`：字符串数组，模板级默认层次列表，可为空。
     4. `defaultChecks`：字符串数组，模板级默认验收内容列表，可为空。
     5. `isActive`：布尔，控制是否可被新实例选择，默认 `true`。
   6. `createdAt` / `updatedAt`：系统时间戳。

## 可报价分项名称（PhasePriceItem）

- **用途**：为每个分项模板维护一个或多个“可计价的分项名称”（如涵洞的混凝土、模板、钢筋部分），每条记录包含独立单价与计价说明，供产值/财务模块直接使用。管理界面支持新增/修改/删除操作，方便按规范或构成拆分价格。
- **字段**
     1. `id`：唯一标识。
     2. `phaseDefinitionId`：关联 `PhaseDefinition`（必填）。
     3. `name`：分项名称（如 “涵洞混凝土”），便于界面展示，必填。
     4. `spec?`：可选规格，用于与进度中 `spec` 字段匹配，默认留空表示面向整个分项。
     5. `measure`：枚举 `LINEAR` / `POINT`，默认继承分项的计量方式，也可重新指定。
     6. `unitString?`：计价单位（如 `m³`、`m²`），仅在 UI 上展示。
     7. `description?`：可填写计价依据、构成组件等说明文字。
     8. `unitPrice?`：金额（decimal，西非法郎），可空表示使用分项定义自身 `unitPrice` 作为回退值。
     9. `isActive`：布尔，控制此条是否参与列表与产值计算，默认 `true`。
    10. `createdAt` / `updatedAt`：时间戳。

> 说明：产值页面会优先尝试匹配 `phaseDefinitionId + spec` 的可报价条目，再使用分项默认价格；管理页面通过 `/value/prices` 提供增删改查入口，确保每个可报价名称与对应价格一一对应。

## 层次与验收内容定义（LayerDefinition / CheckDefinition）

- **用途**：去重存储全局可选的层次/验收内容，供分项模板或分项实例选择与继承，避免同名条目分散为孤立字符串。
- **字段（两类结构一致）**
     0. `id`：唯一标识。
     1. `name`：名称（唯一，不区分大小写），必填。
     2. `isActive`：布尔，可停用旧条目避免继续被选择。
     3. `createdAt` / `updatedAt`：系统时间戳。

## 道路分项实例（RoadPhase）

- **用途**：某条道路上实例化的分项工程，绑定一个分项定义，并允许对默认层次/验收内容进行覆盖或扩展。
- **字段**
     0. `id`：唯一标识。
     1. `roadId`：关联 `RoadSection`。
     2. `phaseDefinitionId`：关联 `PhaseDefinition`（必填）。
     3. `name`：显示名称，默认继承模板，可在实例层重命名。
     4. `measure`：枚举，默认继承模板；如与模板不同则以实例为准。
     5. `intervals`：区间列表 `{ startPk, endPk, side, spec?, billQuantity? }`，实例必填（设计量由此计算）。
        - `spec`：规格，针对边沟、路缘石、过道涵等同一路段存在多种规格的结构物，选填；与层次/验收内容一样绑定在分项上，并在报检弹窗展示。
        - `billQuantity`：计量工程量，选填，无单位。用于结算口径，独立于现场延米/单体展示量。
     6. `pointHasSides`：布尔，仅当 `measure=POINT` 时生效；为 `true` 时单体分项前端按左右侧分开展示点位，默认 `false`。
     7. `layerIds`：引用 `LayerDefinition` 的 ID 列表，实例可选；为空时使用模板默认层次。
     8. `checkIds`：引用 `CheckDefinition` 的 ID 列表，实例可选；为空时使用模板默认验收内容。
     9. `resolvedLayers` / `resolvedChecks`：派生字段（API/视图用），规则为“若实例有绑定则使用实例列表，否则使用模板默认值”。
    10. `designLength`：数值，按区间与侧别计算。
    11. `createdAt` / `updatedAt`：系统时间戳。

> 继承与覆盖规则：路段下新建分项实例时选择一个模板，初始层次/验收内容取模板默认值；实例可新增/删除候选，保存后 `layerIds`/`checkIds` 记录实例实际选中的定义集合。报检弹窗展示与提交时使用 `resolvedLayers`/`resolvedChecks`。

## 分项区间（PhaseInterval）

- **用途**：记录每条区间/点位的起终桩号、规格、层次和计量信息。
- **字段**
     0. `id`：唯一标识。
     1. `phaseId`：关联 `RoadPhase`。
     2. `startPk` / `endPk`：区间起止桩号。
     3. `side`：区间侧别（`BOTH` / `LEFT` / `RIGHT`）。
     4. `spec?`：规格文字。
     5. `layers`：字符串数组，记录当前区间可选层次名称，来自提交时 `PhasePayload.intervals.layers`。
     6. `layerIds`：整数数组，对应 `LayerDefinition.id`，由当前区间的层次名称映射为模板的定义 ID，用于区分每条区间各自的层次集合。
     7. `billQuantity?`：计量工料值。
     8. `createdAt` / `updatedAt`：时间戳。

> 说明：保存时会根据模板 `defaultLayers` 里的 `LayerDefinition` 名称做名称 → ID 映射，若某个名称不属于模板则报错；该映射结果记录在 `layerIds`，使每个区间都能各自声明层次 ID 而不会只用分项级的 `layerIds`。

## 报检记录（InspectionRequest）
- **用途**：记录分项的报检预约与提交信息。
- **字段**
     0. `roadId` / `phaseId`：关联路段与分项。
     1. `side`：枚举 `BOTH` / `LEFT` / `RIGHT`。
     2. `startPk` / `endPk`：起讫桩号。
     3. `appointmentDate`：预约报检日期（日期粒度）。
     4. `submittedAt` / `submittedBy`：报检提交时间与提交人。
     5. `status`：枚举 `PENDING` / `SCHEDULED` / `SUBMITTED` / `IN_PROGRESS` / `APPROVED`。
     6. `updatedAt` / `updatedBy`：最近更新时间与更新人。
     7. `layers` / `checks` / `types`：数组字段，记录层次、验收内容、报检类型。
     8. `submissionOrder`：提交单编号，数字，可空。
     9. `remark`：多行备注。

## 财务记账字段（FinanceEntry）

- **用途**：记录项目级财务流水，分类依赖 `lib/data/finance-cost-categories.json` 的树状分类。
- **字段**
     0. `id`：唯一标识（UUID）。
     1. `sequence`：自增流水号，按创建顺序生成。
     2. `projectId`：关联项目（必填，独立于道路 `RoadSection`，用于在同一系统下管理不同项目的财务，不与道路进度绑定）。
     3. `reason`：事由（文本，必填）。
     4. `categoryKey`：所选分类叶子节点的 key（必填，对应分类树的 `key`）。
     5. `parentKeys`：字符串数组，从根到父节点的 key，便于快速还原路径/面包屑与筛选（保存时写入）。
     6. `amount`：金额（decimal，必填）。
     7. `unitId`：关联金额单位字典（必填，可维护列表，初始包含“西法”“美金”“人民币”）。
     8. `paymentTypeId`：关联支付方式字典（必填，可维护列表，初始包含“现金”“现金支票”“转账支票”“办事处代付”“无票据支出”）。
     9. `paymentDate`：支付日期（日期，必填）。
    10. `tva`：税费（decimal，可空，默认为 0）。
    11. `remark`：备注（可空）。
    12. `isDeleted`：布尔，软删标记，默认 `false`。
    13. `deletedAt`：软删时间（可空）。
    14. `deletedBy`：关联 User（可空，软删操作者）。
    15. `createdAt` / `updatedAt`：时间戳。
    16. `createdBy`：关联 User（记录填报人）。

## 财务主数据

- **Project（财务项目）**：`id`、`name`、`code?`、`isActive`、`createdAt`、`updatedAt`；初始 5 个项目：邦杜库市政路项目、邦杜库边境路项目、邦杜库供料项目、铁布高速项目、阿比让办事处。
- **FinanceUnit（金额单位）**：`id`、`name`、`symbol?`、`isActive`、`sortOrder`、`createdAt`、`updatedAt`；默认包含“西法”“美金”“人民币”。
- **PaymentType（支付方式）**：`id`、`name`、`isActive`、`sortOrder`、`createdAt`、`updatedAt`；默认包含“现金”“现金支票”“转账支票”“办事处代付”“无票据支出”。
- **FinanceCategory（分类树）**：存储自定义/扩展后的财务分类节点，字段含 `key`（唯一）、`parentKey`、`label.zh`、`label.en?`、`label.fr?`、`code?`、`isActive`、`sortOrder`、`createdAt`、`updatedAt`。

## 权限与账户模型

- **Permission**：`code`（唯一标识，如 `road:manage`、`report:edit`）、`name`、`createdAt`、`updatedAt`；当前权限编码覆盖：
  - 成员：`member:view`、`member:edit`、`member:manage`、`role:manage`、`permission:view`
  - 道路/进度/报检：`road:view`、`road:manage`、`progress:view`、`progress:edit`、`inspection:create`
  - 日报：`report:view`、`report:edit`
  - 财务：`finance:view`、`finance:edit`、`finance:manage`
  - 产值计量：`value:view`、`value:create`、`value:update`、`value:delete`
  - 开发路线：`roadmap:view`、`roadmap:create`、`roadmap:update`、`roadmap:delete`
- **Role**：`name`（唯一，如 `Admin`、`Employee`）、`permissions`（多对多）、`createdAt`、`updatedAt`。
- **User**：账号/权限字段包含 `username`（唯一）、`passwordHash`（salt + hash）、`roles`（多对多）、`createdAt`、`updatedAt`；个人资料字段见下方“成员管理字段”。
- 默认角色与权限：
  - Admin：拥有全部权限。
  - Employee：`road:view`、`progress:view`、`inspection:create`、`report:view`、`report:edit`、`finance:view`。
- 默认账号：`GanXing`（密码 `Admin888`，角色 `Admin`，拥有全部权限）、`User1`（密码 `use1`，角色 `Employee`，只有填写日报/修改权限）。

## 成员管理字段

### User（主表/共有字段）
- `id`：自增整型。
- `name`：姓名，必填（默认空字符串）。
- `gender?`：枚举（男/女）。
- `nationality`：受控下拉（中/法双语标签），候选见下方“国籍列表”。
- `phones`：字符串数组，不区分主次、不强制国家码。
- `joinDate`：入职日期（date，创建成员默认当天）。
- `position`：岗位名称，来源于现有成员岗位去重下拉，可手动新增。
- `employmentStatus`：枚举，`ACTIVE`（在职）、`TERMINATED`（离职）、`ON_LEAVE`（休假）。
- `terminationDate?` / `terminationReason?`：离职日期与原因（仅详情展示，不在列表列出）。
- `username` / `passwordHash`：账户名与哈希密码（复用现有认证流程）。
- `roleIds`：多对多角色关联。
- `createdAt` / `updatedAt`：自动时间戳。
- `createdBy` / `updatedBy`：操作用户（审计）。

### UserChineseProfile（中方扩展）
- `userId`：关联 `User`。
- `frenchName?`：法语名。
- `idNumber?`：身份证号。
- `passportNumber?`：护照号。
- `educationAndMajor?`：毕业院校与专业。
- `certifications`：资格证书数组（名称列表）。
- `domesticMobile?`：国内手机号。
- `emergencyContactName?` / `emergencyContactPhone?`：紧急联系人及电话（单个）。
- `redBookValidYears?`：红皮书有效年限（整数，手动输入，每个自然年末自动减 1，至 0 停止）。
- `cumulativeAbroadYears?`：累计出国年限（手动输入，自 2025-12-31 起每年自动加 1）。
- `birthplace?`：籍贯。
- `residenceInChina?`：国内常住地。
- `medicalHistory?`：既往病史。
- `healthStatus?`：健康状况。

### UserExpatProfile（外籍扩展，预留）
- `userId`：关联 `User`。
- 其他字段暂未定义，保留以便后续无破坏扩展。

### 国籍列表（中文 / Français）
- 中国 / Chine
- 西非：科特迪瓦 / Côte d’Ivoire、塞内加尔 / Sénégal、几内亚 / Guinée、马里 / Mali、布基纳法索 / Burkina Faso、尼日尔 / Niger、贝宁 / Bénin、多哥 / Togo、毛里塔尼亚 / Mauritanie、佛得角 / Cap-Vert、加纳 / Ghana、冈比亚 / Gambie
- 中非：喀麦隆 / Cameroun、乍得 / Tchad、刚果（布）/ Congo、刚果（金）/ RDC、中非共和国 / Centrafrique、加蓬 / Gabon、赤道几内亚 / Guinée équatoriale、卢旺达 / Rwanda
- 东非：吉布提 / Djibouti、科摩罗 / Comores、塞舌尔 / Seychelles、马达加斯加 / Madagascar、毛里求斯 / Maurice
- 南部非洲：刚果（金） / RDC、刚果（布） / Congo、布隆迪 / Burundi、莫桑比克 / Mozambique
> 说明：`spec` 可选，当多个规格共享一个单价时留空即可，系统会将该价格视为默认；若某个规格或构件需要独立价格（如边沟的特定规格或涵洞的各组成），需新增一条记录并在 `spec` 中写明规格/构件名。页面会根据 `phaseDefinitionId + spec` 匹配价格，没找到时再退回到分项默认价值。

## 开发路线（RoadmapIdea）

- **用途**：把首页扩展空间升级为可进入的开发路线，集中记录新增模块/想法，状态留痕可追溯。
- **字段**
     1. `title`：必填，想法/模块标题。
     2. `details?`：可选，补充验收标准、接口需求、上线时间等备注。
     3. `priority`：1-5，优先级，默认 3。
     4. `importance`：1-5，重要度，默认 3。
     5. `difficulty`：1-5，难度，默认 3。
     6. `status`：枚举，`PENDING`（待开发）、`DONE`（已完成）。切换为 `DONE` 时写入完成时间，重新打开时清空。
     7. `completedAt?`：完成时间戳。
     8. `createdBy?` / `updatedBy?`：操作用户（可为空）。
     9. `createdAt` / `updatedAt`：自动时间戳。
- **交互**：首页入口跳转 `/roadmap`，可新增想法、查看待开发与已完成列表，并在列表中直接切换状态。
