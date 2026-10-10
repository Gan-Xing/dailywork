# AI Chat Module (Portable)

This folder contains a project-agnostic chat runtime with tool calling support.

## Core
- `types.ts`: core interfaces (adapter, tools, messages).
- `prompt.ts`: system prompt builder.
- `planner.ts`: planning stage that proposes data requirements and candidate APIs.
- `runtime.ts`: multi-turn tool execution loop (planner + executor, tool scheduling safeguards).
- `utils.ts`: JSON extraction helpers.

## How to reuse
1. Implement a model adapter (see `adapters/deepseekAdapter.ts`).
   DailyWork can also use `adapters/responsesAdapter.ts` through `AI_CHAT_PROVIDER=responses` with `AI_CHAT_BASE_URL`, `AI_CHAT_MODEL`, and a server-only `AI_CHAT_API_KEY`. On this server, the unified CLIProxyAPI v8 gateway runs on port 8320 with `gpt-6.1-sol` and retains the custom transcription and embeddings routes. Verify model access with a real inference request because `/v1/models` is only a catalog.
2. Define tool list with permission gates.
3. Call `runChat()` with your adapter, tools, session, and messages.
4. (Optional) Pass `onEvent` to stream planner/executor plan/step/tool progress to your UI.

The core files do not depend on Next.js or Prisma and can be copied to another project.

## Dailywork API catalog
- `scripts/generate-api-docs.ts` regenerates `lib/ai-chat/adapters/dailywork/apiCatalog.ts` with input/output schemas.
- Regenerate via:

```bash
npx tsc scripts/generate-api-docs.ts --module commonjs --target es2020 --outDir .tmp --esModuleInterop --skipLibCheck
node .tmp/generate-api-docs.js
rm -rf .tmp
```

## Debugging
- Enable the debug toggle in `/ai-chat` to reveal tool calls and parameters in the UI.

## Semantic hints
- `docs/api-semantic.json` stores API semantic hints (summary/intents/examples + returnType/detailEndpointKey/evidenceFields).
- Routes without a curated semantic entry remain discoverable through path/domain hints; generated entries are not treated as verified business meaning.
- The planner/executor uses these hints to expand list endpoints into detail calls when evidence is missing.

## Streaming UI
- The dailywork UI uses an SSE endpoint at `/api/ai-chat/stream` to render live plan/step progress.
