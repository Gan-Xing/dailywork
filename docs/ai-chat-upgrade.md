# AI Business Workflows

## Scope

The existing `/ai-chat` is the only entry point. No shell, SQL, deployment or
arbitrary HTTP-write tool is exposed. This release covers complete bill-review
Amorce queries, previewed changes to existing weekly plans, and weekly-plan PDF
generation/download. Bill measurement writes, photo upload/binding, payroll writes
and submission-document changes still require separately reviewed tools.

The home module grid includes an AI assistant card in Chinese and French, linking
to the existing `/ai-chat` page. It uses the existing recent-visit ordering and
locked-card behavior: guests must log in, and accounts without `ai-chat:view`
cannot enter. The card does not load conversations, invoke a model, or grant any
business permissions.

## Query Contract

- `list_bill_junctions` uses an exact project code and optionally a review/road.
- `get_junction_quantities` requires the returned review key, road slug, side and
  canonical PK. Nearby PKs, mainline records and distinct reviews are not merged.
  Explicit shared-side records are marked against double counting.
- Confirmation, measurement, dimensions, formulas, Excel rows and photos remain
  separate. Missing records do not establish physical absence.
- At most 1000 scoped candidates are read in one RepeatableRead snapshot. A
  larger scope is explicitly partial, never an invented complete answer.
- Complete results bypass generic sample compression and have deterministic
  user-facing answers. Other compressed API results retain pagination metadata
  and an incomplete-coverage warning.

## Writes and Authorization

AI access (`ai-chat:view`) is independent of business grants. Queries need the
existing module's read permission; weekly-plan changes additionally need
`material:create`, and signed exports need `signature:use`. No grant is added to
users or roles. Module permissions remain globally scoped where the original
module is globally scoped; project assignment is not invented as new RBAC.
The Admin-only Tanda review remains Admin-only through AI. Tools recheck access
before every call/retry/cache hit and before publishing a result. Internal API
requests carry freshly verified role/grant snapshots instead of browser cookies.

`prepare_weekly_plan_changes` only saves a 30-minute preview. The model cannot
commit it. The human reviews exact IDs and field differences in the existing
conversation, then confirms through a separate authenticated endpoint.

Execution reloads current database roles and ACTIVE permissions, verifies owner
and the complete plan fingerprint, and changes at most 20 explicit rows in a
Serializable transaction. New rows go last. Unspecified quantities, receipts,
prices, headers and unrelated rows are preserved. In-transit/arrived rows require
manual editing. Physical deletion, prices and receipt confirmation are not AI
operations. Destinations belong in `phone`, not `transporter`.

The task result and business changes commit together. Repeated confirmations
return the verified result. Only known aborted serialization conflicts retry
the transaction. Changed/expired previews require a new preview. Affected field
values are queried back and compared before completion.

## Persistence

`AiChatSession`, `AiChatMessage` and `AiChatMemory` are per-user server records.
Client user IDs, timestamps, personal notes and quoted messages grant no authority.
Every endpoint reloads current grants. Session/client-key uniqueness makes
message retries idempotent; older history uses explicit cursors.

Server-generated answers record their current permission requirements and Admin
role provenance. Losing a required grant redacts the old answer in history and
model context without deleting its audit record. Client imports cannot supply
authorization metadata. Existing client-provided history is untrusted reference
data, never proof of current access or authoritative business facts.

Original IndexedDB data is not deleted. Only current-user namespaced databases
can be imported idempotently; the old unowned database is never imported.
Personal notes preserve preferences, not authoritative business quantities.

## PDF Lifecycle

`request_weekly_plan_pdf` prepares an export preview identifying plan and signature
choices. After confirmation a fixed worker checks current grants
and the saved plan version, renders the existing template, waits for images/fonts,
and closes Chromium. Requested signed exports require active approver/editor
signatures and fail explicitly if missing. The plan is checked again after export.

Private owner-scoped R2 artifacts store SHA-256 checksums. Failed database saves
compensate the new R2 upload. Artifact downloads recheck owner, `ai-chat:view`,
`material:view` and, for signed tasks, `signature:use`.

Queued and generated are separate facts. Completion returns an authenticated
download link in the conversation; no public R2 URL or third-party recipient is
accepted. Expired leases resume a saved artifact rather than generating duplicates.
Failed PDF generation can be manually retried at most three times.

Website AI does not connect to Telegram, email or other delivery channels.
Legacy `telegram:true` tasks are rejected rather than dispatched. CodexBridge
server operations and its existing Telegram delivery are separate and unchanged.

## Operation

Review all earlier pending migrations before applying the additive
`20261109090000_add_ai_chat_workflows` and
`20261109110000_protect_ai_chat_history` migrations. Never run `migrate dev`, reset,
or `db push` on a shared database. Do not publish unrelated dirty worktree changes
with this feature.

Confirmation wakes a worker using Next.js `after()`. Run a supervised worker
alongside the web service for automatic restart recovery:

```bash
pnpm exec tsx scripts/ai-chat-worker.ts
pnpm exec tsx scripts/ai-chat-worker.ts --once
```

Database leases prevent concurrent claims. No user cookies are stored. Only
fixed PDF jobs resume; interrupted model reasoning is not replayed as a mutation.
Deleting a conversation cancels unstarted jobs and retains completed action audit
records with a cleared session reference.

Server-only configuration:

- Existing model gateway and private R2 settings remain in use.
- `SITE_BASE_URL`: public origin for reverse-proxy same-origin checks.
- `CHROMIUM_EXECUTABLE_PATH` or `PUPPETEER_EXECUTABLE_PATH`: working Chrome binary.

No Telegram credentials, recipient mappings or external-delivery permissions are
needed or provisioned for website AI. Do not copy developer-bridge credentials.

## Verification

External model and R2 calls are mocked. Real database integration tests
refuse non-localhost hosts or any database not named `dailywork_ai_test`.

```bash
node --import tsx --test tests/aiChat*.test.ts
AI_CHAT_TEST_DATABASE_URL="$ISOLATED_TEST_URL" DATABASE_URL="$ISOLATED_TEST_URL" \
  node --import tsx --test tests/aiChatWorkflows.test.ts
AI_CHAT_TEST_DATABASE_URL="$ISOLATED_TEST_URL" \
  node --import tsx tests/aiChatBrowserSmoke.ts
HOME_AI_TEST_ARTIFACTS="$(mktemp -d /tmp/dailywork-home-qa-XXXXXX)" \
AI_CHAT_TEST_DATABASE_URL="$ISOLATED_TEST_URL" \
  node --import tsx tests/homeAiCardBrowserSmoke.ts
pnpm exec tsc --noEmit --incremental false
```

Browser smoke uses a temporary app copy, isolated Postgres and a mock model. It
tests real confirmation/writeback, SSE, reload persistence, wrong-task rejection
and mobile width without restarting production. PDF tests additionally render a
real landscape PDF with embedded fixture signatures. No production signatures
or live external deliveries are used in automated tests.
