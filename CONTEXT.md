# Monai Context

Monai is a Persian-first personal finance PWA. It imports Iranian bank SMS messages as drafts, lets the user verify and enrich them, stores verified transactions in Cloudflare D1, and answers questions using only verified data.

## Architecture

The codebase follows feature-based clean architecture:

- `shared/contracts`: Zod contracts shared across frontend and Worker.
- `shared/parsing`: deterministic SMS normalization and extraction.
- `src/features`: Worker feature routes and application services.
- `src/infrastructure/db`: Drizzle D1 schema and client.
- `src/shared`: transport helpers.
- `app/src/features`: React feature modules with React Hook Form and TanStack Query.
- `app/src/components/ui`: owned shadcn components.
- `app/src/components/ai-elements`: focused owned AI Elements components.
- `app/src/app`: composition root, providers, navigation, and responsive shell.

## State Boundaries

- TanStack Query owns server state.
- React Hook Form owns transient form state.
- nuqs owns URL navigation state.
- Sonner owns transient notifications.
- React local state owns dialog visibility and draft input.
- Zustand is intentionally not used because no state currently requires it.

## AI

The Worker uses Vercel AI SDK with Google AI Studio. Provider and model details remain server-side.

- Secret: `GOOGLE_API_KEY`

The model receives only verified transaction summaries. Pending drafts are excluded. Client-facing errors never expose provider or model details. Datetimes in the chat context are formatted as Tehran-local Jalali (`YYYY/MM/DD HH:mm`, via `formatJalaliDateTime` in `shared/parsing/jalali.ts`) so the model never reads UTC date parts, and the system prompt instructs it to answer dates only in the Jalali calendar.

`occurredAt` is always stored as a UTC ISO instant (Jalali SMS datetimes are converted with the fixed Tehran +03:30 offset in `jalaliToIso`). Every user-facing surface renders it back in Tehran/Jalali: the transactions list pins `timeZone: "Asia/Tehran"`, and the manual transaction dialog uses the `@jalali-js/react` `DatePicker` (`precision="datetime"`, Jalali system, `fa` locale) — no typed dates — seeded with `nowJalaliTehran` and converted through the shared converter. The picker is themed by mapping `--jalali-*` variables onto the app's tokens in `app/src/index.css`. Do not display raw `occurredAt` strings to users or the model.

Chat messages (user turns and completed assistant answers, as AI SDK UIMessages) are persisted: in D1 via the `chat_messages` table in production, and in the Vite dev server's in-memory `createChatHistoryStore`. Both stores keep only the most recent `CHAT_HISTORY_LIMIT` (20) messages: saves trim the history to the last 20, and D1 deletes rows outside the window. 20 is also the maximum safe batch — one save inserts up to 20 rows × 5 columns = 100 bound parameters, D1's per-statement limit. Do not raise the limit without batching the insert. The chat page loads the saved history from `GET /api/chat/messages` before rendering; assistant answers render as Markdown (bold, lists, tables); a `dot-elastic` (three-dots) indicator shows while a response is awaited. On desktop, Enter sends a message and Shift+Enter or Ctrl+Enter inserts a newline.

Bank SMS balances (`مانده`/`موجودی`) are captured per account at import; the chat context includes the latest verified balance per account and their total, and balance questions are answered only from that block.

## Development

`bun run dev` uses Vite with a server-only in-memory API adapter. Production uses the Cloudflare Worker and D1.

Zoom is disabled app-wide on mobile: the viewport meta pins `maximum-scale=1, user-scalable=no`, and `html` sets `touch-action: pan-x pan-y`. All focusable form controls (including the Jalali `DatePicker` via `--jalali-font-size: 1rem`) must keep font-size ≥ 16px so iOS never auto-zooms on focus — enforced by an e2e test.

Never commit `.env`, `.dev.vars`, API keys, raw production SMS data, or user financial records.
