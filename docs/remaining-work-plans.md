# Remaining work plans — 2026-10-23

The user authorized the backend structure and frontend workflow. Actual remaining work will be entered only after the user confirms each price item. Deployment must leave all existing signed bills, calculation records, remarks, working measurements, contract/actual BoQ items, finance and site records intact. No production seed, example, inferred remainder, or automatic completion import is authorized.

## Identity and sources

- Reuse `BoqItem`, signed bill revisions, source template leaves and roads. A plan is anchored by the exact project, signed revision and source line key. `boqItemId` may be null for source items not yet mapped; a price-code string is never a unique identity. Supplementary template items may be reviewed without fabricating a signed price or amount.
- A GET is strictly read-only. Do not call progress getters that can initialize workflows. Original source cells, signed quantity/amount snapshots, original calculation corrections and manual notes remain independent of the work-plan domain.
- Signed cumulative quantities come from the selected verified source. Never sum historical cumulative values or add original subtotals to detail rows. Missing source quantities are not zero.
- Template-only items retain their original values in the source grid, but are not automatically treated as formally measured quantities. Until an archived signed-line relationship establishes the billing basis, their signed cumulative quantity/amount and final forecasts remain unknown, including after remaining scopes are confirmed.

## New domain

`BoqWorkPlan`, `BoqWorkScope`, `BoqWorkBinding`, `BoqWorkAllocation` and `BoqWorkEvent` form a separate, additive domain. The plan holds a draft and the last confirmed snapshot; editing a draft does not replace confirmed totals. Scopes keep stable UUIDs and project/road/PK/side/spec, nullable decimal quantity, completion state, quantity confirmation, contract/variation basis, and optional independent price. Binding identifies a real signed-source line. Allocations and events prepare explicit partial matching and append-only history; the first release exposes matching preflight without writing allocations.

Scope completion is `COMPLETED`, `NOT_COMPLETED` or `UNKNOWN`, independent of quantity confirmation and bill coverage. Partial completion is represented by separate completed and not-completed portions. No state is inferred from geometry, stock, signed billing, progress percentages or an absent inspection. User confirmation may be the evidence; attachments are optional.

Plan states are `UNCONFIRMED`, `DRAFT`, `CONFIRMED`, `CONFIRMED_NONE` and `NEEDS_REVIEW`. Only an explicit complete-scope confirmation with all required quantities establishes a complete forecast. An explicit empty confirmation establishes no remaining work. Unreviewed items and incomplete drafts produce null forecast values, not zero. Prices have separate confirmation and original/approved-change/provisional/unknown bases. A pending variation or provisional price is not an approved contract value.

All numeric HTTP values are decimal strings. Server arithmetic uses Decimal. Unknown remains null. Contract quantities, approved-scope forecasts and forecasts including pending variations are separate. Forecast amounts use signed cumulative engineering amount HT plus the applicable confirmed remaining rates; they never substitute net payable TTC, receipts, retention or advance recoveries.

## HTTP contract

- `GET /api/value/signed-bills/[id]/work-plans`: `value:view`; returns `BoqWorkPlansResponse` from `lib/value/boqWorkPlans.ts`. It includes exact source items, virtual unconfirmed states, existing plans, current baseline hash, edit eligibility and ordinary read-only road references.
- `POST` on the same route: `value:update` and session actor; `BoqWorkPlanPostInput` selects a real `lineKey`, expected version, baseline hash and `save-draft`, `confirm` or `confirm-none`. Writes only the new domain, with transaction-level conflict protection and append-only old/new event data.
- `POST .../work-plans/match-preflight`: `value:update`; read-only and explicitly deferred for nonempty matching until a verified successor-bill binding workflow exists. Nonempty proposals return `valid:false`, `matched:false`, `written:false` and a clear `unsupportedReason`; any capacity, unit, conservation or remaining-quantity calculations are diagnostic scenarios only, not verified matches. An empty preflight may return `valid:true` after baseline, version and membership checks, but still returns `matched:false`, `written:false` and `unsupportedReason:null`. It never writes a signed bill, binding or allocation. The latest-editable-anchor rule and prohibition on reusing baseline/earlier periods remain unchanged; neither is bypassed to manufacture a successful match.

Historical periods, drafts and superseded signed revisions are read-only. A current baseline change, including meaningful source correction, requires review. Ordinary calculation remarks must not invalidate quantity confirmation. Source membership, stale versions, cross-project references, duplicate scope IDs and mismatched units are rejected server-side. Repeated requests must not duplicate confirmed source bindings or silently overwrite another user.

On every read, roads referenced by either the saved draft or confirmed scopes must still exist in the selected project. A missing/reassigned road makes a current editable item `NEEDS_REVIEW`, with `summary.ready:false` and no remaining/forecast totals, and blocks matching preflight. GET does not persist this derived state or rewrite snapshots. Read-only historical summaries retain their confirmed historical values and explicit history label even if road membership later changes.

## Frontend

Keep the existing signed quantity and amount grid. Extend its item expansion into “计量与剩余明细”. Fetch the plan overview once per selected revision and associate by line key. Initial items visibly say “未确认”. The expansion separates read-only signed calculation rows from editable remaining scopes; headings and cells remain centered and remarks remain the last column. No raw locator JSON or new source-location column is introduced.

Show signed cumulative quantity, completed/unbilled quantity, not-completed/unbilled quantity, unknown completion quantity when present, and approved-scope versus pending-inclusive forecasts in the item's own unit. Do not aggregate metres, square metres and cubic metres into a project quantity. A confirmation card supports draft save, scope and independent price confirmation, explicit no-remaining confirmation, and next-item review. Forms retain drafts on a failed or stale save.

For the same revision/source-kind/line identity, a dirty editor retains local fields and remarks across server refreshes and 409 responses. Saving pauses with an explicit conflict notice. The user may fetch the latest version and discard local inputs, or explicitly retain/rebase them after a fresh GET validates the revision, baseline, plan version, edit eligibility, draft fields and road membership. Retaining inputs never auto-merges another user's changes; review is required before resubmission, and POST still enforces baseline/version concurrency checks. Changing line or revision initializes a separate editor. A price-only draft change is visible on scopes that inherit the applicable plan rate and contributes to missing-price readiness, without replacing confirmed totals or changing independently priced scopes.

For original-contract remaining scopes, default to the exact selected signed line's original unit price without asking the user to reconfirm it. This default is prepared in the edit form and persisted only during an authorized POST; GET remains read-only. The saved price is confirmed `ORIGINAL` and records the signed revision, source line key and price code as its evidence. A missing/blank candidate, or an unconfirmed candidate equal to the signed price, adopts this default. An explicit different custom price, a scope's independent price, and an approved/provisional price remain unchanged. A supplementary template item or absent signed price cannot acquire an invented signed price. Original plan rates apply only to original scopes; changed or pending scopes require their own applicable price. The interface shows “沿用签字单价” and keeps special-price editing available.

## Acceptance

1. Isolated tests cover identity, null/zero, drafts versus confirmation, explicit none, independent price, pending variations, partial quantities, historical/stale writes, member validation, Decimal arithmetic and no signed-source mutation.
2. The additive SQL migration preserves seeded legacy rows in an isolated database. Use `prisma migrate deploy`, never `prisma migrate dev`.
3. Production is backed up before migration. Stage the delta against current production, preserving unrelated source changes. Build, test and lint before cutover; retain rollback build and source.
4. Compare all pre-existing protected rows before/after. All five new tables remain empty after production GET and UI inspection. Do not exercise a real save using fictitious production quantities.
5. Verify the live page in authenticated browser, source values and read-only history; capture the real unconfirmed empty state and available confirmation form. No data-entry completion is claimed until the user supplies and confirms actual remaining work.
