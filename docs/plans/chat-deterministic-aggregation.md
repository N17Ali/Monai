# Chat Deterministic Aggregation — Plan

Status: approved, ready to implement.

## Problem

Three observed failure modes in the Monai chat assistant, all reproducible with the current prompt (`src/features/chat/system-prompt.ts`) and route (`src/features/chat/chat.routes.ts`):

1. **Wrong sums.** Asked «دیروز چقدر خرج کردم؟» the model listed the day's items correctly but computed a wrong total (۱۵,۳۸۱,۹۰۰ instead of ۱۵,۲۲۴,۵۵۰ — off by ۱۵۷,۳۵۰). The itemized list was right; only the addition was wrong. This is inherent LLM arithmetic failure — no prompt wording reliably fixes multi-number addition.
2. **Wrong week boundaries.** The model computed «این هفته» as Sunday→Saturday (Gregorian convention) — «از تاریخ ۱۵ شهریور تا ۲۱ شهریور». The Jalali week runs Saturday (شنبه) → Friday (جمعه); with today = یکشنبه ۲۲ شهریور, "this week" is ۲۱ تا ۲۷ شهریور. The prompt never states the week rule and the context supplies no week boundaries.
3. **Grouping refusal.** Asked «هزینه‌های این ماه را گروه‌بندی کن» the model replied that grouping by category is impossible because transactions only have notes. There is no grouping instruction in the prompt, and no mechanism for the model to compute grouped sums without doing arithmetic itself.

Additionally: the prompt only discloses a 100-transaction sample (`system-prompt.ts:13`) with no honesty rule about truncation, no kinds legend (so the model can contradict the app's own `transactionDirection` rule by counting transfers as spending), and semantic grouping beyond 100 transactions/month or month-over-month comparison is unsupported.

## Goals

- Every total, count, grouped subtotal, and comparison the model states is computed in code — never by the model.
- Aggregates cover **all** verified transactions, not just the 100-item context sample.
- Jalali weeks are Saturday→Friday everywhere in chat.
- Grouping by day / week / month / kind / note (and semantic categories over notes) works for any data volume and across months.
- Chat token cost stays flat as transaction history grows.
- Zero client changes (the chat UI already renders only `text` parts).

## Non-goals

- No changes to the transactions screen, home chart, or balance logic.
- No user-facing `categoryId` assignment yet (the schema field exists but is unpopulated — see Future work).
- No listing/dumping of long transaction lists in chat — itemization stays on the transactions screen.

## Design decisions (locked)

| Decision | Choice | Rationale |
|---|---|---|
| Sum accuracy | Deterministic tools the model calls | The model decides *what* to group (its strength); code computes *sums* (its strength). Prompt wording alone cannot fix arithmetic. |
| Semantic grouping | Model-supplied `groups: [{label, notes[]}]` classification, exact note match | Code can't understand that «اسنپ به دکتر» is transport; the model can't add. Separate the two. Notes dedupe (250 tx ≈ 30–60 distinct) and are meaningful strings the model copies reliably. |
| Volume beyond 100 tx/month | `list_notes` discovery tool over ALL transactions | The classification is only as good as the notes the model can see; discovery over the full list keeps it complete while token cost stays flat. |
| Cross-month comparison | `breakdown: "day"\|"week"\|"month"\|"none"` dimension on the summarize tool | One tool call answers «حمل‌ونقل این ماه با ماه قبل چه تفاوتی داشت؟»; the model reads two numbers, never adds. |
| Context list | Keep the recent-100 sample alongside tools | Itemized questions («دیروز چه خرجی کردم؟») answer instantly without a tool call; tools own everything aggregate. |
| Step budget | `stopWhen: stepCountIs(5)` | list_notes → summarize → answer = 3 steps; unknown-note retry needs headroom. |
| Per-tx extra fields | No `bankId`/`accountId` in context items | Keeps context minimal; account questions stay on `accountBalances`. |

## Architecture

The chat POST route already loads the full verified list (`storage.transactions.listVerified()` via `src/app.ts:22`) before building the prompt — the tool `execute` closures capture that same array, so tool results are always over **all** verified transactions. The 100 cap remains only the prompt sample.

```
User message
  → streamText(system, messages,
      tools: { summarize_transactions, list_notes },
      stopWhen: stepCountIs(5))
  → model calls list_notes (optional, for classification/discovery)
  → model calls summarize_transactions (all sums computed in code)
  → model copies numbers verbatim into a Persian answer
```

The UI (`app/src/features/chat/chat-view.tsx:17-18`) filters message parts to `type: "text"` only, so tool-call/result parts stream and persist invisibly — no client changes.

## Changes by file

### 1. `shared/parsing/jalali.ts` — shared period helpers

- `JALALI_MONTH_NAMES: readonly string[]` — فروردین … اسفند (single source of truth).
- `jalaliMonthName(jm: number): string`.
- `jalaliWeekStart(jy, jm, jd): JalaliDate` — convert to Gregorian, back off `((gregorianUTCDay + 1) % 7)` days (Saturday start), convert back. A Sunday maps back to the previous Saturday.
- `jalaliWeekdayName(...)` — Persian weekday name (شنبه … جمعه) for the `today` context line.
- `app/src/features/transactions/balance-flow.ts:14` drops its local `monthNames` array and imports `JALALI_MONTH_NAMES` (repo rule: shared domain helpers live once).

### 2. `src/features/chat/summary.ts` — new module (pure core + tool bindings)

#### `summarizeTransactions(transactions, query)` — pure function

Input `query`:

```ts
{
  fromJalali?: string;   // "1405/06/21", inclusive day start
  toJalali?: string;     // inclusive day end
  direction?: "in" | "out";
  noteContains?: string; // substring match on userNote
  groupBy?: "day" | "week" | "month" | "kind" | "note" | "none";
  groups?: Array<{ label: string; notes: string[] }>; // semantic classification
  breakdown?: "day" | "week" | "month" | "none";
}
```

Output:

```ts
{
  totalToman: number;
  count: number;
  groups: Array<{ label: string; totalToman: number; count: number; byPeriod?: Array<{ period: string; totalToman: number }> }>;
  ungrouped?: { count: number; totalToman: number }; // only when `groups` is used
  unknownNotes?: string[];                            // notes the model sent that matched nothing
}
```

Rules (each one testable):

- **Range filter**: inclusive; `fromJalali` day start, `toJalali` day end, both Tehran-local via `jalaliToIso(jy, jm, jd, 0, 0)` and `jalaliToIso(jy, jm, jd, 23, 59)`-style bounds. Missing bounds = open-ended.
- **Direction filter** via `transactionDirection` (`shared/contracts/transaction.ts:71`): `expense`, `fee`, `cash_withdrawal` → `"out"`; `income`, `refund` → `"in"`; `transfer_out`, `transfer_in`, `unknown` → neutral, excluded from both. The tool can never disagree with the transactions list or monthly totals — same single sign rule.
- **`groupBy`** (deterministic groupings, code labels):
  - `day` → label `1405/06/21`
  - `week` → label `1405/06/21 تا 1405/06/27` (Saturday-start week; both ends computed)
  - `month` → label `شهریور 1405` (via `jalaliMonthName`)
  - `kind` → labels via existing `kindLabels` (`shared/contracts/transaction.ts:81`)
  - `note` → label = note text; `null` note → «بدون یادداشت»
  - `none` (default) → single overall total
  - Day/week/month groups chronological ascending; kind/note groups sorted by total descending.
- **`groups`** (semantic, model-supplied): exact note-text match against `userNote`; every matched transaction sums into that group's `label`. Safety nets, all code-side:
  - `ungrouped` — transactions in range/filters that matched no group are reported as a remainder, so `Σ groups + ungrouped = total` always holds; nothing silently dropped.
  - `unknownNotes` — notes the model sent that matched no transaction are echoed back so the model can retry (typo recovery).
  - `groups` and `groupBy` are mutually exclusive in practice; if both arrive, `groups` wins.
  - A note may appear in only one group (first match wins).
- **`breakdown`** cross-cuts the chosen grouping (or `groups`) into a `byPeriod` matrix per group. Example — «حمل‌ونقل این ماه با ماه پیش چه فرقی داشت؟» in one call:

```json
{
  "totalToman": 45224550,
  "groups": [
    { "label": "حمل‌ونقل", "totalToman": 6100000,
      "byPeriod": [ { "period": "مرداد 1405", "totalToman": 3200000 },
                    { "period": "شهریور 1405", "totalToman": 2900000 } ] },
    { "label": "درمان", "totalToman": 12443650, "byPeriod": [ "..." ] }
  ],
  "ungrouped": { "count": 4, "totalToman": 310000 }
}
```

- **Money**: input `amountRial` integers; output via `rialToToman` (`shared/money.ts`). Output fields are `*Toman` only — never Rial.
- **Bucketing** is Tehran-local via `tehranJalaliDay` (`shared/parsing/tehran-day.ts`), the same day rule the balance chart uses.

#### `listNotes(transactions, { fromJalali?, toJalali?, direction? })` — pure function

Distinct `userNote` values over the **full** filtered list:

```json
{ "notes": [
    { "note": "هزینه ویزیت دکتر", "count": 2, "totalToman": 8511000, "firstJalali": "1405/06/10", "lastJalali": "1405/06/21" },
    { "note": null, "count": 4, "totalToman": 310000, "firstJalali": "1405/05/28", "lastJalali": "1405/06/19" }
] }
```

Sorted by total descending. Purposes: (a) discovery source for `groups` classification when the range extends beyond the 100-item sample; (b) directly answers «بیشترین هزینه‌ام چه بوده؟» by reading row one, zero arithmetic. ~400 tokens for 250 transactions vs ~3,000 for the raw list.

#### Tool bindings

- `createSummarizeTool(transactions)` and `createListNotesTool(transactions)` — AI SDK v7 `tool()` (installed: `ai@7.0.85`) with zod `inputSchema`s and English descriptions; `execute` closes over the loaded transactions and delegates to the pure core. Pure core stays testable without any AI SDK types.

### 3. `src/features/chat/chat.routes.ts`

- Register `tools: { summarize_transactions: createSummarizeTool(transactions), list_notes: createListNotesTool(transactions) }` on the existing `streamText` call.
- Add `stopWhen: stepCountIs(5)`.

### 4. `src/features/chat/system-prompt.ts`

- Signature: third param becomes `now = new Date()` (replaces the `today` string param). Derive inside:
  - `today = formatJalaliDateTime(now.toISOString())` + Persian weekday name
  - `this week: 1405/06/21 تا 1405/06/27` (Saturday-start, via `jalaliWeekStart`)
  - `this month: شهریور 1405` (so «این ماه» needs no derivation)
- Hoist `const MAX_CHAT_TRANSACTIONS = 100`, used by both the slice and the interpolated window text (no drift).
- Prompt text changes (data blocks unchanged — same JSON shapes):
  - **Weeks**: the week starts Saturday (شنبه) and ends Friday (جمعه); «این هفته» means the supplied `this week` range.
  - **Kinds legend** matching `transactionDirection` exactly: `expense`, `fee`, `cash_withdrawal` are spending; `income`, `refund` are money in; `transfer_out`, `transfer_in` are moves between the user's own accounts and never count as spending or income; `unknown` is unclassified.
  - **Grouping**: group by day/week/month/kind/note as asked. Notes are the only user labels (may be null → «بدون یادداشت»); there is no category field. For semantic categories (خوراک، حمل‌ونقل، درمان…): call `list_notes` for the range, classify the notes, then call `summarize_transactions` with `groups`; merge similar notes (e.g. all اسنپ rides) under one label.
  - **Tool rule**: for ANY total, count, grouped subtotal, or comparison, call `summarize_transactions` — never add, subtract, or compare amounts yourself; copy the tool's numbers verbatim; report `ungrouped` as «بدون یادداشت»/«دسته‌بندی‌نشده» so totals reconcile.
  - **Context window honesty**: the supplied transaction list is the most recent `${MAX_CHAT_TRANSACTIONS}` verified transactions — a sample for itemization; aggregates must come from the tools which see everything. If a question may reach further back than the sample, still answer from tool output and add one short sentence that it covers all verified transactions. If the sample is empty, say no verified transactions exist yet and invite importing/verifying bank SMS.
  - **Balances**: mention each balance's `asOf` (Jalali) so the user knows freshness (existing rule kept).
  - **No raw dumps**: never dump the supplied JSON or tool output back at the user; answer in natural Persian. For "show me everything" requests over long lists, point to the transactions screen.
  - **In-scope arithmetic clarification**: arithmetic over the user's own supplied data/tool results is in scope and expected; only math unrelated to the user's data (e.g. 2+2) is out of scope — so «جمع خرج‌هایم چقدر شد؟» is never refused.

## Test plan

### New `test/chat-summary.test.ts` (pure core)

- Week bucketing — the observed bug: Sunday 1405/06/22 lands in the week starting 1405/06/21; Friday 1405/06/20 lands in the week starting 1405/06/14.
- Inclusive `fromJalali`/`toJalali` bounds (day-start/day-end, Tehran-local).
- Direction: `transfer_out` excluded from `"out"`; `refund` counted in `"in"`; `fee`/`cash_withdrawal` in `"out"`.
- `noteContains` substring filter.
- `groupBy: "note"` with «بدون یادداشت» label for null notes; `groupBy: "month"` labels like «شهریور 1405».
- Semantic `groups`: exact-note matching, `ungrouped` remainder so `Σ groups + ungrouped = total`, `unknownNotes` echo.
- `breakdown: "month"` matrix correctness against fixtures.
- All outputs in Toman (`amountToman === amountRial / 10`).
- Empty result (`totalToman: 0`, `count: 0`).
- `listNotes`: dedupe, count/total per note, `firstJalali`/`lastJalali`, total-descending sort, `null` note included.
- Tool bindings: `createSummarizeTool`/`createListNotesTool` `execute` delegates to the pure core with the captured transactions.

### `test/chat-context.test.ts`

- Update the 3-arg call site to `new Date("2026-09-03T22:22:00.000Z")` (Tehran → 1405/06/13 01:52, a Friday).
- Assert: `today: 1405/06/13 01:52 (جمعه)` line, `this week: 1405/06/07 تا 1405/06/13` (Friday anchor means the week ends that day), `this month: شهریور 1405`, Saturday-week sentence, kinds legend (transfers never count as spending), grouping paragraph, tool rule (never add amounts), window disclosure («most recent 100»), no-raw-dumps sentence.
- All 19 existing assertions keep passing (Gregorian/جلالی/Toman checks unaffected).

### `test/chat-api.test.ts`

- Unaffected: the mock model streams text-only parts, so `stopWhen` never triggers. Existing saved-parts assertion (`step-start` + `text`) stays valid.

## Verification

1. `bun run typecheck`
2. `bun run test`
3. `bun run dev` with a real `GOOGLE_API_KEY`, then:
   - «جمع اسنپ‌ها چقدر شده؟» → one `summarize_transactions` call with `noteContains`/`groups`, exact total.
   - «هزینه‌های این ماه را گروه‌بندی کن» → `list_notes` → `groups` call → table, totals reconcile.
   - «هزینه‌های این هفته» → range = Saturday-start week.
   - «حمل‌ونقل این ماه با ماه قبل چه تفاوتی داشت؟» → one `groups` + `breakdown: "month"` call.
   - «دیروز چه خرجی کردم؟» → itemized from context, total from a tool call.

## Future work (out of scope here)

- Populate `categoryId` (schema already has it, `shared/contracts/transaction.ts:31`) in the enrichment review flow. Once users assign categories, grouping by category becomes pure code and the model's note-classification judgment drops out entirely; the `groups` mechanism remains as the fallback for uncategorized data.
- A dedicated aggregate storage/index if transaction volume ever makes per-request folding over `listVerified()` too slow for D1 (not a concern at personal-finance scale).
