# UI and UX Improvement Plan

## Status

Proposed

## Summary

This plan turns Monai's current functional prototype into a calm, trustworthy financial review tool. It covers both UX (states, flows, recovery, task orientation) and UI (hierarchy, financial semantics, forms, navigation, motion, accessibility).

The experience should help users:

1. Import a bank SMS quickly.
2. Understand what Monai extracted.
3. Correct anything uncertain.
4. Confirm transactions with confidence.
5. Review their financial activity at a glance.
6. Ask useful questions using verified data only.

The central UX principle:

> Every screen should make the user's next action obvious and explain what will happen afterward.

## Current Strengths

- Persian-first interface and copy.
- Jalali date picker and Tehran-local date handling.
- Clear distinction between drafts and verified transactions.
- Responsive desktop dialogs and mobile drawers for the same flows.
- Existing loading, error, and success feedback.
- Chat restricted to verified transaction data.
- Good baseline typography using Vazirmatn.
- Restrained visual styling suitable for finance.

## Main Problems To Solve

| Before | After | Why |
| --- | --- | --- |
| Home always says `اولین پیام بانکی را وارد کن` | Home content changes based on the user's actual state | Static onboarding copy becomes inaccurate after first use. |
| Imported SMS becomes a draft, but the UI moves users between screens without a strong handoff | Import ends with a clear `پیش‌نویس آماده بررسی است` state and direct review action | Users need to know where their data went and what to do next. |
| All enrichment forms appear in one long list | Enrichment becomes a focused one-at-a-time review queue | Reduces cognitive load and makes progress visible. |
| Transaction rows show only title, date, and amount | Rows show amount, direction, type, bank, and date grouping | Financial meaning should be scannable. |
| Chat opens to a mostly empty screen | Chat offers suggested questions and explains its data boundary | Helps users understand the assistant immediately. |
| Mobile navigation is icon-only | Mobile navigation uses labels and clearly separates the main add action | Improves discoverability and reduces memorization. |
| Toasts are often the only mutation feedback | Important changes also appear inline in the relevant screen | Toasts disappear and can be missed. |
| Buttons use broad global transitions | Interactions use precise properties, short durations, and press feedback | Makes the interface feel intentional and responsive. |

## Scope

Affected areas:

- `app/src/App.tsx`
- `app/src/app/app-shell.tsx`
- `app/src/features/enrichment/enrichment-view.tsx`
- `app/src/features/transactions/transactions-view.tsx`
- `app/src/features/transactions/balance-flow.ts` (new, computation + formatting)
- `app/src/features/transactions/balance-flow-chart.tsx` (new, Recharts `LineChart` with smooth curved line)
- `package.json` (add `recharts` dependency)
- `app/src/features/transactions/manual-transaction-dialog.tsx`
- `app/src/features/imports/capture-sheet.tsx`
- `app/src/features/imports/capture-dialog.tsx`
- `app/src/features/imports/clipboard-import-dialog.tsx`
- `app/src/features/chat/chat-view.tsx`
- `app/src/components/ai-elements/conversation.tsx`
- `app/src/components/ai-elements/prompt-input.tsx`
- `app/src/components/ui/button.tsx`
- `app/src/components/ui/dialog.tsx`
- `app/src/components/ui/drawer.tsx`
- `app/src/index.css`
- `test/` component tests and `e2e/` flows

Out of scope:

- Backend API changes beyond what new states require (for example a draft reject endpoint, if missing).
- New data model fields.
- Analytics or onboarding tours.
- Redesigning the visual identity (colors, typography, icon family).

# Phase 1: Establish UX Foundations

## 1. Define User States

Create explicit product states for the home screen and major workflows.

### Home states

- New user with no transactions.
- User with pending drafts.
- User with verified transactions.
- User with no pending drafts.
- User whose data failed to load.
- User returning after a completed import.

### Import states

- Choosing import method.
- Reading clipboard.
- Clipboard permission denied.
- Empty or invalid SMS.
- Sensitive message blocked.
- Duplicate message.
- Draft successfully created.
- Network failure.

### Review states

- Loading drafts.
- One draft ready for review.
- Saving a draft.
- Draft successfully confirmed.
- Draft rejected.
- Save failure.
- Queue completed.

### Chat states

- Loading history.
- Empty history.
- Ready for input.
- Streaming response.
- Response error.
- No verified data available.
- Existing conversation with history.

### Deliverables

- State map for each feature.
- Persian copy for every state.
- UX decision for each state's primary and secondary action.
- Tests for the important state transitions.

## 2. Define Consistent UI Tokens

Extend the existing tokens in `app/src/index.css` with explicit interaction values.

Recommended tokens:

```css
:root {
  --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
  --ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);
  --ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);

  --duration-press: 140ms;
  --duration-popover: 180ms;
  --duration-dialog: 220ms;

  --content-max-width: 1120px;
}
```

Use these consistently for buttons, dialogs, drawers, choice cards, toast-related UI, and inline state changes.

Do not introduce motion into financial data presentation unless it explains a state change.

# Phase 2: Redesign The Home Experience

Primary file: `app/src/App.tsx`
Supporting file: `app/src/app/app-shell.tsx`

## 1. Replace Static Hero Copy

Use state-dependent content.

### New user

```text
اولین تراکنشت را وارد کن
پیام بانکی را اضافه کن تا قبل از نمایش در گزارش‌ها آن را بررسی کنی.
```

Primary action:

```text
ورود پیام بانکی
```

### Pending drafts

```text
۳ تراکنش منتظر بررسی است
اطلاعات استخراج‌شده را بررسی کن تا وارد گزارش‌ها شوند.
```

Primary action:

```text
بررسی تراکنش‌ها
```

### Existing verified data

```text
وضعیت مالی‌ات را بررسی کن
آخرین تراکنش‌ها و خلاصه این ماه را ببین.
```

Primary actions:

```text
ثبت تراکنش
مشاهده تراکنش‌ها
```

## 2. Add Summary Metrics

For users with verified transactions, add a compact summary:

- درآمد این ماه.
- هزینه این ماه.
- مانده یا خالص تغییرات.
- تعداد تراکنش‌های تأییدشده.
- تعداد پیش‌نویس‌های باقی‌مانده.

Design requirements:

- Amounts should be the visual focus.
- Use Persian digits consistently.
- Do not rely on color alone.
- Keep the summary compact on mobile.
- Avoid showing misleading totals when data is incomplete.

## 3. Add A Balance Flow Chart

For users with verified transactions, the home summary includes a line chart showing the cumulative flow of money over time. This is the visual answer to `خالص جریان پول من چطور بوده؟`.

Proposed heading:

```text
روند خالص جریان پول
۱۴۰۳/۰۵/۰۲ تا ۱۴۰۳/۰۵/۲۰ · تغییر کل: +۴۵۰٬۰۰۰ تومان
```

### Data semantics

- Data source: the existing `GET /api/transactions` verified list. Compute the flow client-side; add a dedicated aggregate endpoint later only if the list grows large enough to make client computation expensive.
- Sign each transaction by kind: `income`, `refund`, `transfer_in` are positive; `expense`, `fee`, `transfer_out`, `cash_withdrawal` are negative.
- Group by Tehran-local Jalali calendar day (reuse the shared Jalali helpers; never UTC day boundaries).
- Plot the cumulative net amount per day, not the balance per account, because Monai cannot reconstruct true historical balances across accounts.
- Decide explicitly whether transfers between the user's own accounts should net to zero and be excluded from the flow; document the decision and reflect it in the chart subtitle.
- Show the total net change for the visible range next to the heading.

### Rendering approach

- Add `recharts` as the chart library. Build the chart as a Recharts `LineChart` with a smooth curved line: `<Line type="monotone">` over the daily points, plus a subtle matching `AreaChart`/`Area type="monotone"` fill layer (or a gradient-stroked single line) beneath the line.
- Use categorical x data: one entry per Jalali day, labeled with compact day labels (`۲ خرداد`) via a custom `tickFormatter`; keep full dates for the tooltip.
- Scale y by cumulative value; render a dashed zero `ReferenceLine` only when the flow crosses zero.
- Use compact Persian-digit toman formatting for the y-axis ticks and tooltip (`۴۵۰ هزار تومان`, `۲٫۳ میلیون تومان`) via custom `tickFormatter` and a custom tooltip content component.
- Theme through existing CSS variables (`--primary`, `--border`, `--surface`, `--muted-foreground`) passed as explicit `stroke`/`fill` props so light and dark work without Recharts default colors.
- Interaction: Recharts built-in pointer tracking with `activeDot` on the nearest day; the custom tooltip shows full Jalali date, cumulative value, and that day's net change. Keyboard users get the same data through an accessible summary.
- Wrap the chart in a `ResponsiveContainer` with a fixed height (approximately 176-220px) so it fills card width on mobile and a constrained width on desktop.
- Render only when at least two distinct days exist; otherwise show the summary metrics alone.
- Verify the RTL layout: Recharts renders LTR SVG; place axis labels and tooltips so Persian text reads correctly (tooltip content is RTL by default; x-axis ticks use Jalali day labels that read fine standalone).

### Accessibility

- `role="img"` with a Persian `aria-label` summarizing the range and total net change on the wrapping element (Recharts SVG output is not screen-reader meaningful on its own).
- Provide the underlying daily values as a visually-hidden or collapsible data table for screen-reader users.
- Do not rely on color alone; the tooltip states direction in words (`+`/`−` plus income/expense colors).
- Respect `prefers-reduced-motion`: no `isAnimationActive` line-draw animation; pass `isAnimationActive={false}` to `Line`/`Area` and treat a static chart as the default.

### Placement

- Home, directly below the summary metrics, full card width on mobile and constrained width on desktop.
- Later: the same component can be reused in a transactions overview once Phase 5 lands, without duplicating logic.

## 4. Make The Pending Card Conditional

When `pendingCount === 0`:

- Replace the action card with a completion state.
- Use copy such as `همه تراکنش‌ها بررسی شده‌اند`.
- Offer `ورود پیام جدید` as the next action.

When `pendingCount > 0`:

- Show the count prominently.
- Use an explicit task label.
- Add a direct route to enrichment.

## Acceptance Criteria

- No onboarding copy appears for returning users.
- Users can reach import or review within one obvious action.
- The home page never shows an active action for zero pending drafts.
- Summary values are clearly labeled and readable on mobile.
- The balance flow chart renders for users with verified transactions on at least two distinct Jalali days, is hidden otherwise, and never claims to show per-account bank balances.

# Phase 3: Improve Import Flow

Primary files:

- `app/src/features/imports/capture-sheet.tsx`
- `app/src/features/imports/capture-dialog.tsx`
- `app/src/features/imports/clipboard-import-dialog.tsx`
- `app/src/features/transactions/manual-transaction-dialog.tsx`

## 1. Clarify The Choice Screen

Make clipboard import primary:

```text
خواندن پیام بانکی
پیام کپی‌شده را سریع وارد کن
```

Secondary option:

```text
ثبت دستی
اگر پیام بانکی در دسترس نیست
```

Add a privacy explanation:

```text
پیام فقط برای استخراج اطلاعات تراکنش بررسی می‌شود.
پیام‌های حاوی رمز ذخیره نمی‌شوند.
```

This should be concise and visible before submission.

## 2. Rename The Import Action

Replace `تبدیل به تراکنش` with `ذخیره پیش‌نویس` or `بررسی و ادامه`.

`ذخیره پیش‌نویس` is more precise because the record is not verified yet.

## 3. Improve Clipboard Permission Handling

When clipboard reading succeeds:

- Focus the textarea.
- Preserve the pasted content.
- Show a subtle inline state such as `پیام از کلیپ‌بورد خوانده شد`.

When permission is denied:

- Keep the textarea focused.
- Show the instruction near the field.
- Avoid relying only on a toast.

Suggested copy:

```text
دسترسی به کلیپ‌بورد ممکن نیست. پیام را دستی در کادر جای‌گذاری کن.
```

## 4. Add A Clear Success Handoff

After creating a draft:

```text
پیش‌نویس آماده بررسی است
تا زمانی که آن را تأیید نکنی، در گزارش‌ها نمایش داده نمی‌شود.
```

Actions:

```text
بررسی الآن
بعداً
```

The current behavior closes the dialog and navigates to enrichment, but the transition should explain itself.

## 5. Make Desktop And Mobile Structurally Consistent

The responsive implementation can continue using dialogs on desktop and drawers on mobile, but both should have:

- The same information hierarchy.
- The same headings.
- The same button labels.
- The same privacy explanation.
- The same success behavior.
- A clear back action between choice and form.

Avoid making nested drawers feel like a separate modal stacked on top of the original flow.

## Acceptance Criteria

- Clipboard import is clearly the primary path.
- Users understand that imported records are drafts.
- Clipboard failures have inline recovery.
- Success feedback explains the next step.
- Desktop and mobile use the same product language.

# Phase 4: Redesign Enrichment As A Review Queue

Primary file: `app/src/features/enrichment/enrichment-view.tsx`

This is the highest-value UX improvement.

## 1. Show One Draft At A Time

Instead of rendering all drafts:

```text
تراکنش ۱ از ۳
```

Display one focused review card.

Queue controls:

- `تأیید و بعدی`
- `رد کردن`
- `مشاهده پیام اصلی`
- Optional `بعداً بررسی می‌کنم`

Queue control behavior:

- `تأیید و بعدی` verifies the current draft and immediately advances to the next unresolved draft.
- `رد کردن` rejects the current draft and removes it from the unresolved review queue. Use a confirmation if rejection is irreversible.
- `مشاهده پیام اصلی` expands the original SMS without leaving the current review card.
- `بعداً بررسی می‌کنم` leaves the current draft unresolved and moves it to the end of the queue. This action is optional and should be used when the user cannot confidently verify the current draft.
- If navigation between unresolved drafts is later needed, use explicit `قبلی` and `بعدی` controls. Preserve unsaved edits and never use `قبلی` to reopen a verified transaction.

After confirmation:

- Invalidate the required queries.
- Move to the next draft.
- Keep the user on the enrichment screen.
- Update progress inline.
- Do not require the user to manually select the next card.

## 2. Add An Extraction Summary

Before editable fields, show:

```text
بانک تجارت
برداشت
۴۵٬۰۰۰ تومان
۱۴۰۳/۰۵/۰۲، ۱۴:۳۰
```

Then expose editable fields below.

The summary should distinguish:

- Extracted values.
- User-edited values.
- Inferred values.
- Missing values.

If the date was inferred, show:

```text
این تاریخ از متن پیام حدس زده شده است. لطفاً بررسی کن.
```

## 3. Improve Transaction Type Selection

Add an explicit group label:

```text
نوع تراکنش
```

Use a radio-group pattern or at minimum:

- `aria-pressed`.
- A visible check indicator.
- A strong selected background.
- A non-color selected state.

Options:

- هزینه.
- درآمد.
- انتقال از حساب.
- انتقال به حساب.

## 4. Add Reject Handling

Provide a secondary action:

```text
رد کردن
```

Use a confirmation only if rejection is destructive or irreversible.

Suggested confirmation:

```text
این پیش‌نویس حذف شود؟
پیام اصلی و اطلاعات استخراج‌شده از صف بررسی حذف می‌شوند.
```

If the product needs to retain rejected data for auditability, use:

```text
نادیده گرفتن
```

instead of delete language.

## 5. Add Field-Level Validation

Every editable field should have:

- Visible label.
- Input.
- Error message.
- `aria-invalid`.
- `aria-describedby`.

Fields:

- نوع تراکنش.
- مبلغ.
- تاریخ و ساعت.
- توضیح.

Example:

```text
مبلغ به تومان
[ ۴۵۰۰۰ ]

مبلغ باید بیشتر از صفر باشد.
```

## 6. Preserve Form State On Failure

If confirmation fails:

- Keep all user edits.
- Show the error near the submit controls.
- Offer `تلاش دوباره`.
- Keep the card in the same queue position.

Do not force users to re-enter financial information.

## Acceptance Criteria

- Users can review drafts sequentially.
- Progress is always visible.
- Confirmation automatically advances.
- Rejection is possible.
- Original SMS remains available.
- Failed saves preserve user input.
- All field errors are specific and accessible.

# Phase 5: Improve Transactions List

Primary file: `app/src/features/transactions/transactions-view.tsx`

## 1. Add Date Grouping

Group transactions by Jalali date:

```text
امروز

خرید فروشگاه افق
امروز، ۱۴:۳۰
-۴۵٬۰۰۰ تومان

دیروز

پرداخت حقوق
دیروز، ۰۹:۱۰
+۲۵٬۰۰۰٬۰۰۰ تومان
```

Use the existing `formatJalali` utility as the foundation, but introduce user-facing date group labels.

## 2. Improve Row Hierarchy

Recommended row structure:

```text
[icon] خرید فروشگاه افق                 -۴۵٬۰۰۰ تومان
      امروز، ۱۴:۳۰ · بانک تجارت · هزینه
```

On mobile:

- Keep the amount aligned consistently.
- Avoid overly long titles causing amount wrapping.
- Truncate descriptions carefully.
- Make the full row accessible.

On desktop:

- Use a wider content container.
- Keep amounts aligned in a stable column.
- Add a subtle hover state only for interactive rows.

## 3. Add Financial Semantics

Use:

- `+` for income.
- `-` for expenses.
- Neutral treatment for transfers.
- Labels in addition to color.
- Appropriate icons.

Do not use expense red for every warning or failure if it makes the interface emotionally harsh.

## 4. Add List-Level Empty And Error Actions

Empty state:

```text
هنوز تراکنش تأییدشده‌ای نیست
پیام بانکی وارد کن یا یک تراکنش را دستی ثبت کن.
```

Actions:

```text
ورود پیام بانکی
ثبت دستی
```

Error state:

```text
تراکنش‌ها بارگذاری نشدند.
[تلاش دوباره]
```

## 5. Add Filtering Later

Once the list is sufficiently populated, introduce:

- Date range.
- Income/expense/transfer.
- Bank/account.
- Category.
- Search.

This should be a second iteration, not a prerequisite for the first UI pass.

# Phase 6: Improve Chat UX

Primary file: `app/src/features/chat/chat-view.tsx`

Supporting files:

- `app/src/components/ai-elements/conversation.tsx`
- `app/src/components/ai-elements/prompt-input.tsx`

## 1. Improve Empty State

Current empty state should become an onboarding surface:

```text
از وضعیت مالی‌ات بپرس
پاسخ‌ها فقط بر اساس تراکنش‌های تأییدشده هستند.
```

Suggested prompt buttons:

- `این ماه چقدر خرج کردم؟`
- `بیشترین هزینه‌ام چه بوده؟`
- `هزینه‌های حمل‌ونقل چقدر بوده؟`
- `موجودی حساب‌ها چقدر است؟`

These should be accessible buttons and should either populate or immediately submit the prompt.

## 2. Add Conversation Control

Add:

```text
گفت‌وگوی جدید
```

This gives users control over persisted history and prevents one long conversation from becoming confusing.

## 3. Improve Streaming Feedback

While waiting:

- Keep the input available if appropriate.
- Show a stable submit button width.
- Use a spinner or dot indicator with accessible status.
- Avoid layout jumps.
- Clearly distinguish submitted, streaming, and failed states.

## 4. Improve Chat Error Recovery

Replace a static error message with:

```text
پاسخ دریافت نشد. دوباره تلاش کن.
[تلاش دوباره]
```

The retry behavior should:

- Preserve the last user question.
- Avoid duplicating the user message.
- Keep existing conversation history.
- Not expose provider details.

## 5. Revisit Autoscroll

Recommended behavior:

- Immediately scroll after the user submits a message.
- Smooth-scroll only when the user is already near the bottom.
- Stop automatic scrolling if the user manually scrolls upward.
- Respect reduced-motion preferences.

# Phase 7: Improve Navigation And Shell

Primary file: `app/src/app/app-shell.tsx`

## 1. Improve Mobile Navigation

Current five icon-only destinations are too dense.

Preferred option:

- خانه.
- تراکنش‌ها.
- بررسی.
- گفت‌وگو.

Place `ثبت تراکنش` as a visually distinct central action or floating action button.

If settings remains in bottom navigation, show short labels under all icons.

## 2. Add Active Semantics

For active navigation:

```tsx
aria-current={view === id ? "page" : undefined}
```

Also add:

- Stronger active icon treatment.
- A persistent active indicator.
- Visible pending count for enrichment.
- Clear label when pending count exists.

Example:

```text
بررسی
۳
```

## 3. Improve Header Action

The header add action should:

- Have a tooltip on desktop.
- Have a visible label on mobile if space permits.
- Keep a minimum 44px touch target.
- Have an active press state.
- Remain accessible with a clear Persian name.

# Phase 8: Interaction And Motion Polish

Primary files:

- `app/src/components/ui/button.tsx`
- `app/src/components/ui/dialog.tsx`
- `app/src/components/ui/drawer.tsx`
- `app/src/index.css`

## 1. Replace Global `transition-all`

Current:

```css
transition-all
```

Recommended:

```css
transition-[background-color,border-color,color,box-shadow,transform]
duration-150
ease-[cubic-bezier(0.23,1,0.32,1)]
```

## 2. Add Press Feedback

For primary buttons and choice cards:

```css
active:scale-[0.97]
```

Use only for genuinely pressable elements.

## 3. Keep UI Motion Under 300ms

Recommended values:

- Button press: `100-140ms`.
- Tooltip: `125-180ms`.
- Dialog: `200-240ms`.
- Drawer: `250-350ms` if the existing drawer behavior requires it.
- Queue state update: short opacity transition, not a large movement.

## 4. Gate Hover States

Use hover rules only for devices that support hover:

```css
@media (hover: hover) and (pointer: fine) {
  .choice-card:hover {
    background: var(--surface-muted);
  }
}
```

Touch devices should use active and focus states instead.

## Phase 9: Accessibility Pass

## Required Improvements

- Add `aria-current` to active navigation.
- Add `aria-pressed` or radio semantics to transaction type choices.
- Add `aria-invalid` to invalid fields.
- Connect field errors using `aria-describedby`.
- Use `role="status"` for loading states.
- Use `role="alert"` for actionable failures.
- Add `aria-live="polite"` for queue progress and success states.
- Ensure icon-only buttons have meaningful labels.
- Do not communicate income/expense through color alone.
- Preserve keyboard focus when dialogs change step.
- Return focus to the triggering button after dialogs close.
- Ensure all touch targets are at least 44px.
- Test both RTL layout and keyboard navigation.
- Verify Persian digits and mixed LTR content such as amounts and dates.

# Phase 10: Testing Plan

Existing tests already cover important enrichment, date, import, and chat behavior. Add UI-focused coverage.

## Component Tests

### Home

- Renders new-user state.
- Renders pending-review state.
- Renders verified-data state.
- Hides review action when pending count is zero.
- Opens import flow from the primary action.
- Balance flow: signs each kind correctly, groups by Tehran-local Jalali day, and produces a correct cumulative series.
- Balance flow: renders for two or more distinct days, hidden for fewer.
- Balance flow: compact Persian toman formatting (هزار / میلیون / میلیارد).
- Balance flow: exposes an accessible summary for screen readers.

### Import

- Clipboard content populates the field.
- Clipboard permission failure shows inline guidance.
- Duplicate SMS shows the correct state.
- Sensitive SMS is not treated as a successful import.
- Successful import shows draft handoff.
- Mutation failure preserves entered content.

### Enrichment

- Shows one draft at a time.
- Displays progress.
- Confirms and advances to the next draft.
- Rejects a draft.
- Shows extracted values.
- Shows inferred-date warning.
- Displays field-level validation.
- Preserves values after failed submission.

### Transactions

- Shows loading state.
- Shows retryable error state.
- Shows actionable empty state.
- Groups transactions by date.
- Renders income and expense semantics.

### Chat

- Shows suggested prompts.
- Clicking a prompt submits or fills the question.
- Shows retry action after failure.
- Preserves conversation input.
- Shows accessible streaming status.
- Supports new conversation behavior.

## End-To-End Tests

Add flows for:

1. New user imports SMS and confirms a draft.
2. User imports duplicate SMS.
3. User rejects an imported draft.
4. User adds a manual transaction.
5. User checks the verified transaction list.
6. User asks a suggested chat question.
7. User uses the application on an iPhone-sized viewport.
8. User navigates using keyboard only.
9. Reduced-motion preference is enabled.
10. Theme changes between light and dark mode.

# Implementation Sequence

## Milestone 1: Foundations

- Define UI states and copy.
- Add interaction tokens.
- Replace `transition-all`.
- Add semantic navigation and form states.
- Add initial component test coverage.

## Milestone 2: Home And Import

- Make home state-aware.
- Add summary metrics.
- Add the `recharts` dependency and the balance flow `LineChart` (smooth `monotone` curve).
- Improve import choice hierarchy.
- Rename draft action.
- Add success handoff.
- Improve clipboard failure behavior.

## Milestone 3: Enrichment Queue

- Show one draft at a time.
- Add progress.
- Add extraction summary.
- Add reject handling.
- Add automatic next-item behavior.
- Add inline save errors.

## Milestone 4: Transaction List

- Add financial direction semantics.
- Add date grouping.
- Improve empty/error states.
- Add summary header.

## Milestone 5: Chat And Navigation

- Add suggested prompts.
- Add retry behavior.
- Add new conversation control.
- Improve mobile navigation labels.
- Separate the primary transaction action.

## Milestone 6: Polish And Validation

- Tune motion durations and easing.
- Verify reduced motion.
- Verify RTL and Persian typography.
- Test desktop, tablet, and mobile.
- Run accessibility checks.
- Run unit and end-to-end tests.

# Definition Of Done

The work is complete when:

- The home screen reflects the user's current financial state.
- Users with verified transactions see a balance flow chart of their cumulative net money flow, grouped by Jalali day, with an accessible summary.
- Import clearly distinguishes drafts from verified transactions.
- Users can review drafts one at a time with visible progress.
- Users can reject or correct imported drafts.
- Failed operations preserve entered data and provide retry actions.
- Transactions communicate amount direction, type, date, and source.
- Chat teaches users what questions it can answer.
- Mobile navigation is understandable without memorizing icons.
- All major controls have correct accessible semantics.
- Motion is restrained, interruptible, responsive, and reduced-motion aware.
- Component and end-to-end tests cover the primary success and failure paths.
