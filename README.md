# Monai

Persian-first bank SMS capture, transaction enrichment, and verified-data financial chat.

## Stack

- Bun, React, TypeScript, Vite, Tailwind CSS v4
- shadcn/ui and Hugeicons
- Zod and React Hook Form
- TanStack Query and nuqs
- Sonner
- Drizzle ORM with Cloudflare D1
- Vercel AI SDK and owned AI Elements components
- Google AI Studio through Vercel AI SDK
- Vitest and Playwright

## Setup

```bash
bun install
```

For local Vite development, create an uncommitted `.env` or export the variable in your shell:

```dotenv
GOOGLE_API_KEY=<REDACTED>
```

For Cloudflare production, create the secret:

```bash
bun x wrangler secret put GOOGLE_API_KEY
```

## Commands

```bash
bun run dev
bun run typecheck
bun test
bun run test:e2e
bun run build
bun run db:migrate:local
bun run db:migrate:remote
bun run deploy
```

Local development uses an in-memory Vite API adapter. Production requests are handled by `src/index.ts` and persisted through Drizzle to D1.
