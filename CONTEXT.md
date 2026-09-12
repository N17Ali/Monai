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

`occurredAt` is always stored as a UTC ISO instant (Jalali SMS datetimes are converted with the fixed Tehran +03:30 offset in `jalaliToIso`). Every user-facing surface renders it back in Tehran/Jalali: the transactions list pins `timeZone: "Asia/Tehran"`, the manual transaction dialog and the enrichment review queue both use the `@jalali-js/react` `DatePicker` (`precision="datetime"`, Jalali system, `fa` locale) — no typed dates — seeded with `nowJalaliTehran` (manual) or the draft's stored instant (enrichment) and converted through the shared converter; verifying a draft may send an optional `occurredAt` in `enrichmentUpdateSchema` to correct an extracted or inferred date. The picker is themed by mapping `--jalali-*` variables onto the app's tokens in `app/src/index.css`. Do not display raw `occurredAt` strings to users or the model.

Chat messages (user turns and completed assistant answers, as AI SDK UIMessages) are persisted: in D1 via the `chat_messages` table in production, and in the Vite dev server's in-memory `createChatHistoryStore`. A conversation is capped at `CHAT_HISTORY_LIMIT` (50) messages: once a conversation reaches the cap the composer disables with a notice telling the user to open a new conversation (the notice and the tab bar both offer `گفت‌وگوی جدید`). Saves trim to the same window server-side as a backstop. The client re-sends the full history every turn (stateless LLM chat), so a save first SELECTs the conversation's stored ids, inserts only messages not yet persisted (chat messages are immutable — stored rows are never rewritten), and deletes only ids that fell outside the window, in chunks of at most 98 stale ids per statement. Inserts are chunked to at most 16 rows (96 params) per statement inside one atomic `db.batch`. Both chunkings keep every statement within D1's 100-bound-parameter-per-statement limit regardless of the history limit, so `CHAT_HISTORY_LIMIT` is a product decision (input-token cost per turn grows with it), not a D1 constraint — `test/chat-repository.test.ts` asserts the per-statement parameter counts, the only-new-rows behavior, the window trim, and limit-independence at a 150-message window; `test/chat-limit.test.tsx` and `e2e/chat-limit.pw.ts` cover the composer cap. The chat page loads the saved history from `GET /api/chat/messages` before rendering; assistant answers render as Markdown (bold, lists, tables); a `dot-elastic` (three-dots) indicator shows while a response is awaited. On desktop, Enter sends a message and Shift+Enter or Ctrl+Enter inserts a newline.

Conversations are a server-owned resource (never localStorage): the `conversations` table in D1 (in-memory `createConversationStore` in dev) stores a monotonic `number` per conversation, and the tab list comes from `GET /api/chat/conversations` so it syncs across devices. `POST` creates the next number; `DELETE /api/chat/conversations/:id` closes a tab and deletes its messages, and the list endpoint recreates the default `conversation-1` when no conversations remain. Chat history routes and the chat POST body are scoped by `conversationId` (default `conversation-1`); only the per-device selected tab lives in localStorage (`monai-active-chat`).

Bank SMS balances (`مانده`/`موجودی`) are captured per account at import; the chat context includes the latest verified balance per account and their total, and balance questions are answered only from that block.

`GET /api/transactions` returns the full verified list (used by the home summary/chart — until a dedicated aggregate endpoint is justified). The transactions screen instead pages through it: `GET /api/transactions?limit=N&cursor=...` (max page 100, keyset cursor `occurredAt|id`, ordered `occurredAt DESC, id DESC`) returns `{ transactions, nextCursor }`; the list UI uses `useInfiniteQuery` + an IntersectionObserver sentinel (300px rootMargin) to fetch older rows on scroll, with a `نمایش تراکنش‌های بیشتر` button fallback where IntersectionObserver is unavailable. Cards show the SMS-extracted `accountId` (digits, `dir="ltr"`) on a second line when present.

The home `BalanceFlowChart` (`app/src/features/transactions/balance-flow*.ts`) shows the trend of total balance across all accounts, not net flow (deliberate deviation from the original plan): per Tehran-local Jalali day it takes each account's *closing* balance (the latest `balanceAfterRial` by instant, order-independent — the API returns newest-first), carries accounts forward, and sums them; `netRial` is the day-over-day diff of that total (0 on the first day). Account identity and balance recovery are shared with the chat in `shared/parsing/balance.ts` (`accountKey`: `accountId ?? bankId ?? "unknown"` — never a per-transaction phantom account; `withLegacyBalances` re-parses stored-null balances from the original SMS), so the chart total and the model's balance answer always agree — `test/balance-flow.test.ts` asserts the agreement. The chart renders only with ≥2 distinct days. The `مانده کل` summary (and its tooltip and screen-reader table) shows the exact cumulative balance via `formatExactToman` — never a rounded compact figure. Y-axis ticks use the compact `formatAxisToman` (no "تومان" suffix; narrower width on mobile) so labels never clip or crowd the plot, and chart theming goes through the `.balance-flow-chart` CSS rules so `var(--primary)` etc. resolve in both light and dark themes. `test/balance-flow.test.ts` covers the computation; `e2e/chart.pw.ts` covers axis bounds, compactness, and the hover tooltip.

## Development

`bun run dev` uses Vite with a server-only in-memory API adapter. Production uses the Cloudflare Worker and D1.

Zoom is disabled app-wide on mobile: the viewport meta pins `maximum-scale=1, user-scalable=no`, and `html` sets `touch-action: pan-x pan-y`. All focusable form controls (including the Jalali `DatePicker` via `--jalali-font-size: 1rem`) must keep font-size ≥ 16px so iOS never auto-zooms on focus — enforced by an e2e test.

Never commit `.env`, `.dev.vars`, API keys, raw production SMS data, or user financial records.
