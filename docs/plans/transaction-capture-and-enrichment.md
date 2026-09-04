# Transaction Capture, Enrichment, and Financial Chat Plan

## Status

Proposed

## Summary

Monai will separate three user jobs into dedicated product areas:

1. **Capture** imports a bank SMS or creates a transaction manually.
2. **Enrichment** lets the user review, correct, classify, and verify imported transactions.
3. **Chat** answers financial questions using verified transaction data only.

An imported SMS must never become trusted financial data immediately. Clipboard paste, iOS Shortcut, and future import channels all create the same kind of draft transaction. The Enrichment section is the only place where imported drafts are corrected and verified.

Manual transactions use a dedicated form. Because the user enters their fields directly, they can be saved as verified transactions after validation.

Chat is reserved exclusively for questions and answers. It will not import messages, edit transactions, or conduct enrichment conversations.

## Product Goals

- Make importing one bank SMS take one intentional action.
- Convert imported messages into structured draft transactions.
- Give users a clear place to correct and verify extracted data.
- Keep enrichment separate from financial questions.
- Allow users to create transactions without an SMS.
- Ensure chat calculations use verified records only.
- Preserve the original source message for review and auditing.
- Prevent unknown deposits, transfers, and refunds from corrupting income reports.
- Support Persian, RTL layout, Toman/Rial display, and Jalali dates throughout.

## Non-Goals

The first implementation will not include:

- Reading the SMS inbox directly from the PWA.
- Automatic Android SMS permissions.
- Automatic creation of an iOS personal automation.
- Transaction editing through chat.
- SMS import through the chat composer.
- Unrestricted model-generated SQL.
- Financial or investment advice.
- Automatic verification of imported transactions.
- Merchant inference when no evidence exists in the source message.
- Historical iOS inbox scanning.

## Product Navigation

The primary mobile navigation should contain:

- `خانه`
- `تراکنش‌ها`
- `تکمیل اطلاعات`
- `گفت‌وگو`
- `تنظیمات`

Capture actions should be available from a prominent global action button rather than becoming another permanent navigation destination.

The global action button opens:

- `خواندن از کلیپ‌بورد`
- `ثبت دستی تراکنش`

The Enrichment navigation item should show the number of unresolved drafts:

```text
تکمیل اطلاعات ۳
```

## Terminology

Use the following Persian product terms:

| Domain term | Persian UI label |
|---|---|
| Capture | ثبت تراکنش |
| Imported message | پیام بانکی |
| Draft transaction | تراکنش نیازمند بررسی |
| Enrichment | تکمیل اطلاعات |
| Verified transaction | تراکنش تأییدشده |
| Manual transaction | تراکنش دستی |
| Original message | پیام اصلی |
| Pending review | نیازمند بررسی |
| Unknown type | نوع تراکنش نامشخص |
| Optional note | توضیح اختیاری |

Avoid technical parser language in the user interface.

Do not show:

```text
مبلغ و زمان مشخص است، اما موضوع تراکنش در پیام بانک وجود ندارد.
```

Prefer:

```text
موضوع تراکنش مشخص نیست
```

Followed by a direct structured action:

```text
دسته‌بندی این تراکنش چیست؟
```

## Core Domain Model

### Transaction Source

Every transaction records its origin:

```ts
type TransactionSource =
  | "clipboard"
  | "ios_shortcut"
  | "manual"
  | "future_import";
```

### Transaction Status

Imported transactions move through an explicit lifecycle:

```ts
type TransactionStatus =
  | "processing"
  | "needs_review"
  | "verified"
  | "rejected"
  | "duplicate"
  | "not_financial"
  | "sensitive_blocked"
  | "parse_failed";
```

Manual transactions are validated and saved directly as `verified`.

### Financial Type

Do not model transactions as income versus outcome only:

```ts
type TransactionKind =
  | "expense"
  | "income"
  | "transfer_out"
  | "transfer_in"
  | "refund"
  | "fee"
  | "cash_withdrawal"
  | "unknown";
```

Reports must treat these differently:

- `expense` contributes to spending.
- `income` contributes to income.
- `refund` reduces related spending or is displayed separately.
- `transfer_in` and `transfer_out` do not affect income or spending.
- `fee` contributes to spending but retains its subtype.
- `cash_withdrawal` moves money from an account to cash and should not automatically be treated as spending.
- `unknown` is excluded from trusted summaries until resolved.

### Core Fields

A normalized transaction should contain:

```ts
interface Transaction {
  id: string;
  userId: string;
  source: TransactionSource;
  status: TransactionStatus;

  bankId: string | null;
  accountId: string | null;

  kind: TransactionKind;
  amountRial: number;
  balanceAfterRial: number | null;

  occurredAt: string;
  sourceDateText: string | null;
  dateWasInferred: boolean;

  bankDescription: string | null;
  userNote: string | null;
  categoryId: string | null;
  counterparty: string | null;
  channel: string | null;

  originalMessage: string | null;
  sourceFingerprint: string | null;

  createdAt: string;
  verifiedAt: string | null;
}
```

Money must be stored as integer Rial. Floating-point values must not be used.

The interface may display Toman by default:

```text
۴۱٬۸۰۰ تومان
معادل ۴۱۸٬۰۰۰ ریال
```

### Extraction Metadata

Imported transactions also need field-level extraction metadata:

```ts
interface ExtractionMetadata {
  parser: "bank_rule" | "model_fallback";
  parserVersion: string;
  detectedBank: string | null;

  confidence: {
    kind: number;
    amount: number;
    currency: number;
    date: number;
    account: number;
    description: number;
    category: number;
  };

  inferredFields: string[];
  missingFields: string[];
}
```

Percentages do not need to appear in the interface. They determine which fields require attention.

## Capture Flow

### Clipboard Import

#### Entry Point

The global action menu contains:

```text
خواندن از کلیپ‌بورد
```

This action should:

1. Request clipboard access only after the user taps the button.
2. Read plain text from the clipboard.
3. Show a preview before uploading when practical.
4. Reject empty or excessively long clipboard values.
5. Submit the text to the receipt import endpoint.
6. Create a draft transaction.
7. Open that draft in Enrichment.
8. Never submit clipboard contents to chat.

#### Clipboard Permission Failure

Clipboard APIs may fail or require additional user interaction. Provide a fallback:

```text
دسترسی به کلیپ‌بورد ممکن نشد
پیام بانکی را اینجا جای‌گذاری کنید.
```

Show a text area and an explicit button:

```text
[ تبدیل به تراکنش ]
```

#### Successful Import

After parsing:

```text
تراکنش آماده بررسی است
```

Then navigate directly to the draft.

If several messages are pasted together, either:

- Split confidently recognized messages into multiple drafts, or
- Ask the user to submit them individually until batch splitting is implemented.

Batch parsing is not required for the first slice.

#### Invalid Clipboard Content

Possible outcomes:

- Not a financial message.
- OTP or authentication message.
- Duplicate message.
- Unsupported message format.
- Multiple ambiguous messages.

Each outcome requires a specific explanation. Do not return a generic parser error.

Example:

```text
این متن شبیه پیام تراکنش بانکی نیست.
```

For OTP content:

```text
برای حفظ امنیت، پیام‌های حاوی رمز یا کد ورود ذخیره نمی‌شوند.
```

### iOS Shortcut Import

The iOS Shortcut sends a message to an authenticated import endpoint.

It follows the same backend pipeline as clipboard import:

```text
Shortcut
→ Import endpoint
→ Sensitive-content filter
→ Deduplication
→ Bank parser
→ Model fallback if necessary
→ Draft transaction
→ Enrichment queue
```

Shortcut imports must not create verified transactions.

The PWA should eventually expose:

```text
راه‌اندازی ورود پیامک در آیفون
```

The app can install a prepared shared Shortcut, pair it with a scoped device credential, and guide the user through manually creating the Message automation.

Shortcut onboarding is a later implementation phase and must not block clipboard import.

### Manual Transaction Flow

#### Dedicated Section

Manual transaction entry should be a dedicated form or full-screen sheet opened from:

```text
ثبت دستی تراکنش
```

It must not use chat and must not require an original SMS.

#### Required Fields

- Transaction kind
- Amount
- Currency/display unit
- Jalali date
- Account

#### Optional Fields

- Time
- Category
- Description
- Counterparty
- Balance after transaction

#### Kind Selection

Use structured choices:

```text
[ هزینه ]
[ درآمد ]
[ انتقال بین حساب‌ها ]
[ بازگشت وجه ]
[ کارمزد ]
[ برداشت نقدی ]
```

If the user selects transfer, ask for direction and optionally the other account.

#### Save Behavior

Because the user explicitly entered the data:

1. Validate amount, currency, kind, date, and account.
2. Convert the amount to canonical integer Rial.
3. Save directly as `verified`.
4. Set `source` to `manual`.
5. Set `verifiedAt` immediately.
6. Display the saved transaction.
7. Offer `ویرایش` and `ثبت تراکنش دیگر`.

Manual transactions should not enter the Enrichment queue unless validation fails or the user explicitly chooses `ذخیره به‌عنوان پیش‌نویس` in a later enhancement.

## Enrichment Section

### Purpose

Enrichment is the single place for:

- Reviewing extracted transaction fields.
- Correcting incorrect values.
- Resolving financial type.
- Selecting a category.
- Adding an optional note.
- Verifying or rejecting imported transactions.
- Inspecting the original message.

Chat must not duplicate this workflow.

### Queue Layout

Use filters:

```text
[ نیازمند بررسی ۳ ]
[ تأییدشده ]
[ نادیده‌گرفته‌شده ]
```

Prioritize unresolved drafts in this order:

1. Uncertain amount or currency.
2. Unknown financial kind.
3. Uncertain date or account.
4. Possible duplicate.
5. Missing category.
6. Missing optional description.

### Draft Card

A compact draft card should show:

```text
برداشت از بلو                     نیازمند بررسی

۲۳٬۹۰۰ تومان
۱۲ تیر ۱۴۰۵، ساعت ۲۲:۳۵

حساب                    بلو
نوع                     هزینه
دسته‌بندی               انتخاب نشده
توضیح                   ثبت نشده

[ مشاهده پیام اصلی ]
[ نادیده گرفتن ]        [ بررسی و تأیید ]
```

### Review Screen

Separate trusted financial fields from optional enrichment:

```text
اطلاعات تراکنش

مبلغ
۲۳٬۹۰۰ تومان

نوع تراکنش
هزینه

تاریخ
۱۲ تیر ۱۴۰۵، ساعت ۲۲:۳۵

حساب
بلو

تکمیل اطلاعات

دسته‌بندی
انتخاب کنید

توضیح
اختیاری
```

Actions:

```text
[ رد کردن ]
[ ذخیره تغییرات ]
[ تأیید تراکنش ]
```

### Required Verification

The following fields affect financial reports and must be resolved:

- Amount
- Currency
- Transaction kind
- Date
- Account, when the user has multiple accounts

Category and user note are optional unless a future report explicitly depends on them.

### Missing Category

For expenses, offer common categories:

```text
[ خرید روزانه ]
[ خوراک ]
[ رفت‌وآمد ]
[ قبوض ]
[ سلامت ]
[ تفریح ]
[ پوشاک ]
[ سایر ]
```

For income:

```text
[ حقوق ]
[ فروش ]
[ پاداش ]
[ سود ]
[ هدیه ]
[ سایر ]
```

The available taxonomy should remain small during the first version.

### Original Message

The user must be able to expand:

```text
مشاهده پیام اصلی
```

The source message should:

- Be displayed in a readable RTL block.
- Preserve original spacing where useful.
- Mask unnecessary account, card, and IBAN digits.
- Never appear in analytics events.
- Never be included in normal application logs.

### Verification Result

When the user confirms:

1. Validate all critical fields.
2. Set status to `verified`.
3. Record `verifiedAt`.
4. Preserve original extraction values.
5. Record user corrections separately.
6. Include the transaction in reports and chat.
7. Remove it from the unresolved count.

### Rejection

The user may reject a draft as:

- Not a transaction.
- Duplicate.
- Incorrect message.
- Sensitive message.
- Other.

Rejected records must not affect reports.

## Chat Section

### Scope

Chat exists only for questions about financial data.

Examples:

```text
این ماه چقدر هزینه کردم؟
```

```text
بیشترین هزینه من در مرداد چه بوده؟
```

```text
در سه ماه گذشته چقدر درآمد داشتم؟
```

```text
هزینه رفت‌وآمد من نسبت به ماه قبل چقدر تغییر کرده؟
```

### Explicit Restrictions

The chat composer must not:

- Detect or import SMS messages.
- Accept clipboard transaction parsing.
- Create manual transactions.
- Enrich drafts.
- Modify or delete transactions.
- Confirm transactions.
- Run unrestricted SQL.

If a user pastes a bank SMS into chat, respond:

```text
برای ثبت این پیام از «خواندن از کلیپ‌بورد» استفاده کنید.
```

Include a button that opens the capture action. Do not process the SMS through chat.

If a user asks to edit a transaction:

```text
برای ویرایش تراکنش، آن را در بخش «تراکنش‌ها» باز کنید.
```

### Data Boundary

By default, chat queries only:

```text
status = "verified"
```

Chat answers must state when pending drafts could affect the answer:

```text
این ماه ۸٬۴۲۰٬۰۰۰ تومان هزینه تأییدشده دارید.
۳ تراکنش هنوز نیازمند بررسی هستند و در این محاسبه لحاظ نشده‌اند.
```

A button may link to Enrichment:

```text
[ بررسی ۳ تراکنش ]
```

The assistant must not ask enrichment questions after the link is selected. Navigation transfers the user to the dedicated Enrichment workflow.

### Query Safety

Use approved read-only financial operations:

- Spending by period
- Income by period
- Period comparison
- Transactions by category
- Largest transactions
- Transaction search
- Account balance history where available

The model selects an operation and validated parameters. Server code executes a parameterized query scoped to the authenticated user.

The model must not receive unrestricted database credentials or arbitrary SQL execution.

All arithmetic must come from SQL or deterministic TypeScript, not model-generated calculations.

## Transaction Section

The transaction list contains verified transactions by default.

Filters:

- Period
- Account
- Financial kind
- Category
- Source

Each transaction detail page allows:

- Edit
- Change category
- Add or update note
- Reject/delete according to retention policy
- View source message when available
- View correction history when useful

Pending drafts belong to Enrichment, not the normal verified transaction list.

## Parsing Pipeline

Use deterministic bank parsers before model fallback:

```text
Normalize text and digits
→ Block OTP/security messages
→ Detect duplicate
→ Detect bank/template
→ Parse with bank-specific rule
→ Validate extracted fields
→ Use model fallback for unsupported templates
→ Create draft
```

Initial bank parser coverage:

- Blu
- Mehr/Resalat
- Mellat
- Tejarat

Normalization must support:

- Persian, Arabic, and Latin digits
- Attached labels such as `برداشت27,272,000`
- Leading and trailing positive/negative signs
- Rial and Toman
- Multiple date separators
- Jalali dates with omitted year portions
- Persian and Arabic character variants
- Optional balance, account, description, and time fields

The parser must not invent missing merchants, categories, dates, or descriptions.

## Deduplication

Generate a source fingerprint using normalized values such as:

```text
user
+ normalized source text
+ bank
+ account
+ kind
+ amount
+ occurrence time
+ balance
```

A matching fingerprint should produce a duplicate result rather than another draft.

Potential duplicates that are not exact matches should be shown for user review instead of silently discarded.

## Deployment Architecture (Cloudflare)

### Platform Overview

Monai runs entirely on Cloudflare. One Worker serves the React PWA and the API, backed by D1 and Workers AI:

| Concern | Cloudflare product |
|---|---|
| App and API server | Workers (TypeScript) |
| Static PWA assets | Workers Assets, served by the same Worker |
| Relational storage | D1 (SQLite) |
| Model calls | Workers AI binding |
| Rate limiting | KV counters |
| Abuse protection on auth | Turnstile (optional, later) |

There is no separate backend server, container, or database host to operate.

### Worker Layout

```text
src/
  index.ts        fetch entry, routing, auth guard
  auth.ts         register, login, sessions
  imports.ts      clipboard + shortcut import pipeline
  parsing/        normalization, bank rules, model fallback
  enrichment.ts   draft review, verify, reject
  transactions.ts list, edit, manual entry
  chat.ts         question-only route with approved operations
  model/          Workers AI wrapper, call logging
app/              React PWA, built to static assets
migrations/       D1 SQL migrations
```

### Bindings

```json
{
  "name": "monai",
  "main": "src/index.ts",
  "assets": { "directory": "app/dist" },
  "d1_databases": [
    { "binding": "DB", "database_name": "monai", "database_id": "<id>" }
  ],
  "ai": { "binding": "AI" },
  "kv_namespaces": [
    { "binding": "LIMITS", "id": "<id>" }
  ]
}
```

Secrets (session signing key, import token pepper) are set with `wrangler secret put` and never committed.

Create the D1 primary in a location close to the users, for example `WEUR`, at database creation time.

### D1 Schema

The domain model maps to the following tables:

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL,
  revoked_at TEXT
);

CREATE TABLE accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  bank_id TEXT,
  label TEXT NOT NULL
);

CREATE TABLE transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  account_id TEXT REFERENCES accounts(id),
  source TEXT NOT NULL,
  status TEXT NOT NULL,
  kind TEXT NOT NULL,
  amount_rial INTEGER NOT NULL,
  balance_after_rial INTEGER,
  occurred_at TEXT NOT NULL,
  date_was_inferred INTEGER NOT NULL DEFAULT 0,
  bank_description TEXT,
  user_note TEXT,
  category_id TEXT,
  channel TEXT,
  original_message TEXT,
  fingerprint TEXT,
  extraction_meta TEXT,
  created_at TEXT NOT NULL,
  verified_at TEXT
);

CREATE UNIQUE INDEX idx_tx_fingerprint
  ON transactions(user_id, fingerprint);

CREATE INDEX idx_tx_user_status ON transactions(user_id, status);
CREATE INDEX idx_tx_user_time ON transactions(user_id, occurred_at);

CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  kind TEXT
);

CREATE TABLE import_credentials (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  label TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_used_at TEXT,
  revoked_at TEXT
);

CREATE TABLE chat_messages (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE model_calls (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  purpose TEXT NOT NULL,
  model TEXT NOT NULL,
  latency_ms INTEGER,
  outcome TEXT,
  created_at TEXT NOT NULL
);
```

Column meanings follow the domain model: `source` holds `clipboard | ios_shortcut | manual | future_import`, `status` holds the draft lifecycle states, `kind` holds the financial type, and `extraction_meta` stores the JSON extraction metadata.

Jalali conversion stays in application code. The database stores canonical ISO 8601 timestamps; the interface renders Jalali dates.

### D1 Constraints to Respect

- D1 is SQLite with a 10 GB database ceiling on the paid plan (500 MB free). Personal transaction history is text-sized; this is ample.
- Each D1 database processes queries one at a time. Keep queries short and indexed; throughput depends directly on query duration.
- At most 100 bound parameters per statement. Chunk large `IN` lists.
- Use `db.batch()` for multi-statement writes, for example verifying a draft and recording the correction in one batch.
- Time Travel provides point-in-time recovery (30 days paid, 7 days free). It is a backstop, not a backup strategy; user-initiated JSON export remains the real backup path.
- Read replication is unnecessary at this scale. If it is enabled later, adopt the Sessions API with bookmarks at the same time.

### Workers AI Usage Policy

The model has exactly two touchpoints:

1. Fallback parsing of SMS templates that no bank rule matched.
2. Chat question routing and answer phrasing over the approved read-only operations.

Rules:

- Deterministic bank rules run first. A message parsed by a rule is never sent to the model. This controls cost and limits raw SMS exposure.
- The chat tool set is the approved operation list: spending by period, income by period, period comparison, by category, largest transactions, search. The model selects an operation and arguments; server code validates the arguments and runs a parameterized, user-scoped query.
- The model never generates SQL and never receives another user's rows.
- Every call is logged in `model_calls` with purpose, model, latency, and outcome. Message bodies are never logged.
- Monitor neuron usage against the 10,000 neurons per day free allocation. Upgrade to Workers Paid only when real usage requires it.

### Rate Limiting

Enforced at the edge with KV counters:

- Imports: 30 per minute per user.
- Chat questions: 200 per day per user.
- Auth attempts: 5 per minute per IP.
- Shortcut endpoint: 60 per hour per import credential.

Exceeding a limit returns a Persian explanation, never a silent failure.

### Environments and Workflow

```text
Local:      wrangler dev (local D1 database)
Migrations: wrangler d1 migrations apply DB --local
Deploy:     wrangler d1 migrations apply DB --remote
            wrangler deploy
```

A preview database (`monai-preview`) can run the same migrations for staging. Migrations are forward-only and additive; destructive changes require a new migration with a data-preserving backfill.

## Security and Privacy

### Sensitive Message Filter

Reject messages containing authentication indicators such as:

- `رمز پویا`
- `رمز یکبار مصرف`
- `کد ورود`
- `کد تایید`
- `OTP`
- `verification code`

Sensitive messages must be blocked before model processing and must not be retained.

### Data Minimization

- Store only fields needed for transaction history and verification.
- Mask card, account, and IBAN values in the interface.
- Do not include raw SMS bodies in analytics.
- Do not include raw SMS bodies in ordinary logs.
- Provide account-level export and permanent deletion.
- Document whether and when original messages are deleted after verification.

### Shortcut Credentials

Each iOS Shortcut connection receives a separate revocable credential that can only submit candidate messages.

It cannot:

- Read transactions.
- Read chat.
- Modify verified records.
- Delete data.
- Access another user.

## API Changes

All routes are served by the single Cloudflare Worker described in Deployment Architecture, with D1 as the only datastore. The exact route names may follow existing conventions, but responsibilities should be explicit.

### Capture

```text
POST /api/imports/clipboard
POST /api/imports/shortcut
```

Both create imported drafts through the same service.

### Manual Entry

```text
POST /api/transactions/manual
```

Creates a validated, verified transaction.

### Enrichment

```text
GET    /api/enrichment
GET    /api/enrichment/:id
PATCH  /api/enrichment/:id
POST   /api/enrichment/:id/verify
POST   /api/enrichment/:id/reject
```

### Chat

```text
POST /api/chat/questions
```

Accepts financial questions only.

Existing receipt, draft, review-queue, transaction, and question routes should be consolidated where possible instead of duplicating behavior behind new endpoint names.

## Existing Codebase Impact

The current implementation already contains:

- Receipt parsing and processing.
- Draft serialization and review queue routes.
- Manual transaction creation.
- Enrichment actions.
- Chat question handling.
- Transaction and category APIs.

The implementation should reuse those capabilities while changing product boundaries.

Likely affected areas include:

- `app/src/App.tsx`
- `app/src/api.ts`
- `src/chat.ts`
- `src/receipts.ts`
- `src/review-queue.ts`
- `src/reading.ts`
- Transaction and draft migrations
- Receipt, review queue, chat, and end-to-end tests

New decisions should state:

- Capture is separate from chat.
- Enrichment is the only imported-transaction verification workflow.
- Chat is question-only.
- Clipboard and Shortcut imports converge on one draft pipeline.
- Manual entry creates verified transactions through a dedicated form.

## Implementation Phases

### Phase 0: Cloudflare Foundation

- Scaffold the single Worker with Workers Assets for the PWA and `/api/*` routing.
- Create the D1 database with a primary location near the users.
- Add the initial migration covering users, sessions, accounts, transactions, categories, import credentials, chat messages, and model calls.
- Add the AI binding and the logged model-call wrapper.
- Add the KV rate-limit namespace and secrets.
- Deploy the skeleton so every later phase ships behind a working pipeline.

### Phase 1: Domain and Route Boundaries

- Define transaction source, status, and financial kind.
- Confirm canonical Rial storage.
- Separate imported drafts from verified transactions.
- Make chat routes reject receipt-like input.
- Ensure chat queries verified transactions only.
- Preserve existing parser and review behavior behind clearer boundaries.

### Phase 2: Clipboard Capture

- Add the global capture action.
- Implement `خواندن از کلیپ‌بورد`.
- Add manual paste fallback.
- Route parsed messages directly to Enrichment.
- Handle OTP, duplicate, unsupported, and non-financial outcomes.
- Add clipboard import tests.

### Phase 3: Dedicated Enrichment

- Create the Enrichment queue and count badge.
- Implement draft review and editing.
- Add required financial-kind resolution.
- Add optional category and note fields.
- Add original-message disclosure.
- Add verify and reject actions.
- Remove enrichment interactions from chat.

### Phase 4: Manual Transaction Entry

- Create the dedicated manual form.
- Support Jalali date entry and Persian number normalization.
- Convert Toman/Rial safely to integer Rial.
- Validate required fields.
- Save directly as verified.
- Add edit and success flows.

### Phase 5: Question-Only Chat

- Remove receipt submission from the chat composer.
- Reject pasted SMS with a link to clipboard capture.
- Restrict model tools to approved read-only operations.
- Include pending-draft counts in relevant answers.
- Add links from chat to Enrichment without conducting enrichment inline.

### Phase 6: Bank Parser Corpus

- Add anonymized Blu examples.
- Add anonymized Mehr/Resalat examples.
- Add anonymized Mellat examples.
- Add anonymized Tejarat examples.
- Test amount, currency, kind, balance, account, and Jalali date independently.
- Add regression cases for missing descriptions and attached numeric labels.
- Add refund, transfer, fee, reversal, and duplicate cases.

### Phase 7: iOS Shortcut

- Add device-scoped import credentials.
- Add pairing codes.
- Publish the prepared Shortcut.
- Add the PWA installation button.
- Add Persian setup guidance.
- Add manual Message automation instructions.
- Add connection testing and revocation.
- Send Shortcut imports to the same Enrichment queue.

## Test Strategy

### Unit Tests

- Persian, Arabic, and Latin digit normalization.
- Rial/Toman conversion.
- Jalali date parsing.
- Bank-specific message parsing.
- OTP detection.
- Exact duplicate detection.
- Financial-kind report behavior.
- Manual transaction validation.
- Verified-only chat query filters.

### API Tests

- Clipboard import creates a draft.
- Shortcut import creates a draft.
- Manual entry creates a verified transaction.
- Draft verification changes report inclusion.
- Draft rejection prevents report inclusion.
- Cross-user access is rejected.
- Chat cannot mutate transaction data.
- Chat cannot process receipt-like input.
- Pending drafts are excluded from totals.
- Migrations apply cleanly to an empty local D1 database.
- All queries are parameterized and scoped to the authenticated user.
- Rate limits reject excessive imports, chat questions, and auth attempts.

### End-to-End Tests

1. Copy a Blu SMS, tap clipboard import, review it, and verify it.
2. Paste an unknown withdrawal and classify it as an expense.
3. Paste an unknown deposit and classify it as a transfer.
4. Reject an OTP message before storage.
5. Detect a duplicate pasted SMS.
6. Enter a manual expense using Toman and a Jalali date.
7. Ask chat for monthly spending and verify that only confirmed records are counted.
8. Confirm a pending transaction and observe the chat total change.
9. Verify mobile RTL navigation and keyboard behavior.
10. Verify fallback behavior when clipboard access is denied.

## Acceptance Criteria

- Clipboard import is accessible without entering chat.
- Clipboard text becomes a draft ready for Enrichment.
- Imported drafts never affect reports before verification.
- Enrichment is available as a dedicated section.
- The user can correct all critical transaction fields.
- Category and note enrichment remain optional.
- Manual entry is a dedicated section or full-screen form.
- Valid manual transactions are saved as verified records.
- Chat accepts questions only.
- Pasting an SMS into chat redirects the user to Capture.
- Chat calculations use verified transactions only.
- Pending transaction counts are disclosed when relevant.
- Money is stored as integer Rial.
- Dates are displayed and entered in Jalali format.
- RTL and Persian formatting work on mobile and desktop.
- OTP messages are rejected before AI processing or storage.
- Raw bank messages are absent from application analytics and ordinary logs.
- Existing bank-message examples pass parser regression tests.
- A single Cloudflare Worker serves the PWA and the API.
- The D1 schema and indexes match the domain model, with a unique fingerprint index for deduplication.
- Model calls are logged without message bodies.
- Deployment and migrations run through the documented wrangler workflow.

## Product Success Metrics

Track:

- Clipboard import completion rate.
- Percentage of imported messages successfully parsed.
- Percentage of drafts requiring critical-field correction.
- Time from import to verification.
- Percentage of drafts abandoned.
- Percentage of transactions receiving optional categories.
- Manual transaction completion rate.
- Number of financial questions per active user.
- Percentage of chat answers affected by pending drafts.
- Week-two import and verification retention.

Do not treat optional description completion as a primary success metric. Accurate financial kind, amount, currency, and date are more important.

## Rollout Decision

The Cloudflare foundation (Phase 0: Worker, D1, migrations, deploy pipeline) lands first, before any product slice.

Ship the first product slice in this order:

1. Clipboard import.
2. Dedicated Enrichment.
3. Manual transaction entry.
4. Question-only chat using verified data.
5. Expanded deterministic bank parsers.
6. iOS Shortcut onboarding.

The iOS Shortcut is promising, but it should build on a trusted draft and Enrichment pipeline rather than becoming a separate transaction path.
