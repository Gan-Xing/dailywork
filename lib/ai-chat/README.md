# AI Chat Module (Portable)

This folder contains a project-agnostic chat runtime with tool calling support.

## Core
- `types.ts`: core interfaces (adapter, tools, messages).
- `prompt.ts`: system prompt builder.
- `runtime.ts`: multi-turn tool execution loop (supports optional planning + step execution).
- `utils.ts`: JSON extraction helpers.

## How to reuse
1. Implement a model adapter (see `adapters/deepseekAdapter.ts`).
2. Define tool list with permission gates.
3. Call `runChat()` with your adapter, tools, session, and messages.
4. (Optional) Pass `onEvent` to stream plan/step/tool progress to your UI.

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

## Streaming UI
- The dailywork UI uses an SSE endpoint at `/api/ai-chat/stream` to render live plan/step progress.
