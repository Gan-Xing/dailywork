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
     1. `name`：路段名称，文本，必填。
     2. `startPk`：起点标识，文本，支持 `PK0+000` 或交叉口描述，必填。
     3. `endPk`：终点标识，文本，必填。
     4. `createdAt` / `updatedAt`：系统维护的时间戳，用于审计与排序。
