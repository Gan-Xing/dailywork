# Signed bill implementation contract — 2026-10-22

User authorization: implement a signed bill version layer, use the best practical design, and make the production website agree with the actual signed documents. Keep it small. Existing originals, engineering work measurements, the 878 road review records, road details, BoQ catalog, invoice/cheque facts and finance workflow events must remain intact.

## Scope and single source for display

- Add an immutable `BoqBillRevision` document snapshot and a small append-only `BoqBillRevisionEvent` audit log. No additional parallel period/line/adjustment tables. A document snapshot deliberately captures the signed document independently of mutable working measurements. Only one current signed revision per project and integer period participates in official display. Historical snapshots never add to totals.
- Keep `BoqMeasurement` as working calculations and preserve all current 309 rows. The signed view reads revisions; the working view reads existing measurements. Never sum the two sources together.
- Keep `ValueBillReview` as road/quantity checking. Its `CONFIRMED` does not mean a document was signed. Do not change its 878 records or overwrite its source file identity.
- Reuse existing FileAssets; do not upload or copy the 107 files again. Primary PDF and Excel have real FileAsset FKs. Additional evidence can use existing FileAssetLink with a native signed-bill-revision entity and validated file refs.
- Existing 23 formal periods: project 1 periods 1–10; project 2556 periods 1–6; project 3313 periods 1–7. Tanda 7 is an unsigned user draft and must not become a formal signed revision. Period 0 advances remain outside formal engineering bills.

## Shared TypeScript DTO (backend owner publishes exact declarations)

`lib/value/signedBills.ts` exports:

- `SignedBillRevisionDto`: `id`, `projectId`, `periodIndex`, `revision`, `status: 'DRAFT' | 'SIGNED'`, `isCurrent`, `currency`, `signedAt: string | null`, `signedPdfFileId: number | null`, `calculationFileId: number | null`, `grossHt`, `netHt`, `vatAmount`, `netTtc` (decimal strings or null), `lines`, `adjustments`, `summary`, `source`, `changeReason`, `createdAt`, creator/verifier/activation metadata as needed.
- `SignedBillLine`: `key: string`, `boqItemId: number | null`, `sourceCode: string | null`, `designation: string`, `unit: string | null`, `unitPrice`, `previousQuantity`, `quantity`, `cumulativeQuantity`, `previousAmount`, `amount`, `cumulativeAmount` (all decimal strings or null), optional `evidence` (validated JSON source locators). Source zero and source blank are different. Negative reversal quantities are valid. Non-item/subtotal rows must not be counted twice.
- `SignedBillAdjustment`: `key`, `kind: 'ADVANCE_RECOVERY' | 'RETENTION_WITHHELD' | 'RETENTION_RELEASE' | 'MATERIAL_DEDUCTION' | 'OTHER'`, `label`, `effectHt` (signed decimal string: negative deducts, positive refunds), optional evidence. A rounding difference is a reconciliation result, never an invented financial adjustment.
- `SignedBillSummary`: optional nullable decimal strings `previousGrossHt`, `cumulativeGrossHt`, `previousNetHt`, `cumulativeNetHt`, `previousNetTtc`, `cumulativeNetTtc`, `vatRate`; optional `includesAdvancePeriodZero` and a source history snapshot. These are what the selected document states, not a mixture of subsequently revised historical periods.
- `SignedBillSource`: validated JSON containing evidence file IDs/hashes and sheet/cell/page locators, notes, explicit verification scope, and import/source identifiers. Signatures are verified from source content/user confirmation, never filenames, upload times or hashes alone.

Use decimal strings across HTTP and JSON. Use Prisma Decimal for reconciliation. Headline amounts in numeric columns retain source cents; original raw source text and source locators retain precision and meaning. Frontend must not call Math.round or global BoQ price to overwrite signed values.

## HTTP endpoints

- `GET /api/value/signed-bills?projectId=N[&periodIndex=P]` (`value:view`) returns `{ revisions: SignedBillRevisionDto[] }`. Current signed revisions are marked; historical previews are distinguishable. No date-as-period encoding in this new API.
- `POST /api/value/signed-bills` (`value:update`) creates a new immutable revision. Body uses DTO content plus `fromMeasurement?: boolean`, `isSignedConfirmed?: boolean`, `activate?: boolean`. If `fromMeasurement` is true, server builds lines for that exact project+period from current working measurements and actual BoQ items; it must not take cumulative working quantities as this-period increments. Explicit imported lines are supported for the verified 23-period backfill.
- `PATCH /api/value/signed-bills/[id]/activate` (`value:update`) selects an existing verified SIGNED revision. Body includes `expectedCurrentRevisionId: number | null` and a reason. Reject stale selection or activation of draft. Do not change invoice/cheque values or workflow dates.
- Creating SIGNED requires real PDF file, known source header totals, explicit existing-signature confirmation and actor audit. Unknown signing date remains null; a missing date must not be fabricated. This archives an already signed document; it is not an electronic signature flow.
- Atomic per project+period lock and transaction for revision numbering, idempotency by canonical source/content digest, and switching current version. Database unique indexes must enforce one current revision and unique revision numbers. Validate project, period, file IDs, finite decimal strings, signed/blank semantics, and no duplicate line keys. All material source content is immutable; activation metadata is separate.

## UI

- Measurement tab defaults to a distinct `签字账单` view; `编制计量` still provides the existing editable grid. No silent mixing or replacement of working input fields.
- Signed view: select period (latest formal by default); show exact signed gross HT, deductions/refunds, net HT, VAT and net TTC; source previous/current/cumulative item quantities and amounts; source PDF/Excel; version history; clear reconciliation differences and source links. Label amount as net payable / 签认净应付, never actual cash received.
- The selected document's cumulative figures take precedence over an invented sum of mixed historical versions. History restatement does not rewrite old document snapshots. Latest source history and old original period documents remain distinguishable.
- A concise archive/revision form can snapshot current working entries: period, existing PDF/Excel FileAsset IDs, signed date, four signed totals, adjustment amounts, reason and confirmation that the PDF was checked. No general Excel parser or new upload system is required in this change. Editing creates a new revision; previewing old revisions does not activate them.
- Finance integration: preserve `accountAmount` as original ledger fact, invoice and cheque as actual independent facts. Display current signed net TTC separately or as the clearly labelled signed bill value, showing original ledger amount/difference where present. Do not infer any workflow stage from version publication.

## Backfill and acceptance

1. Build and review all 23 source snapshots before any write. Formal signed PDF beats a conflicting earlier workbook; retain raw evidence and the known Tanda 2/3/5 formal quantity corrections. Latest-history amounts are a separate source context and must not overwrite original signatures.
2. Additive migration only, with production backup. Never `prisma migrate dev`; use `prisma migrate deploy`. Preserve production's unrelated dirty files.
3. Reuse original assets and import idempotently. Preserve all 309 working rows, 391 actual BoQ rows, 36 road details, 25 finance cases, 136 finance events and FinanceEntry content.
4. Verify 23 current formal records and 10/6/7 scope. Every signed headline field matches its cited PDF page. In particular Agni retention/material net differences and the signed 1-FCFA rounding values now display exactly as documents, without adjusting engineering quantities to balance.
5. Tests must cover negative quantities, null versus zero, typed refunds, exact decimal preservation, duplicate/stale activation, draft exclusion and one-current-only totals. Verify the production UI and file links after deployment and retain change/evidence reports.
