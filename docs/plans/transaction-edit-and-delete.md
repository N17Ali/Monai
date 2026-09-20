# Transaction Edit and Delete Plan

## Goal

Allow users to edit and permanently remove verified transactions from the transactions view without bypassing the existing storage, API, validation, and React Query layers.

## Recommended behavior

- Edit verified transactions from the transactions list.
- Remove verified transactions after an explicit confirmation.
- Keep draft transactions in the existing Enrichment workflow.
- Allow editing:
  - Transaction kind
  - Amount
  - Date and time
  - User note
- Preserve provenance fields such as `source`, `bankId`, `accountId`, `originalMessage`, and extraction metadata.
- Scope every mutation to the current user.
- Use permanent deletion for the initial implementation. Keep the existing `rejected` status for rejected drafts rather than repurposing it for deleted verified transactions.

## 1. Extend shared transaction contracts

### File

`shared/contracts/transaction.ts`

Add a schema and type for editing a verified transaction. The payload should contain:

```ts
{
  kind,
  amountToman,
  occurredAt,
  note
}
```

Validation requirements:

- `kind` must not be `unknown`.
- `amountToman` must be positive.
- `occurredAt` must be a valid ISO date.
- `note` must be trimmed and limited to the existing note length.
- The schema should support all non-`unknown` transaction kinds so existing fees, refunds, and cash withdrawals are not silently converted to expenses.

Reuse the shared editable-kind definitions where possible so the manual-entry and edit forms cannot drift apart.

## 2. Extend the transaction storage interface

### File

`src/features/transactions/transaction.storage.ts`

Add a verified-transaction update type using Rial internally and add these methods to `TransactionStorage`:

```ts
updateVerified(id: string, correction: VerifiedTransactionUpdate): Promise<boolean>;
deleteVerified(id: string): Promise<boolean>;
```

Both methods should return `false` when the transaction:

- Does not exist.
- Belongs to another user.
- Is not currently verified.

This keeps mutation behavior consistent with the existing `verify` and `reject` methods.

## 3. Implement storage behavior

### Memory adapter

#### File

`src/features/transactions/transaction.memory.ts`

Implement:

- `updateVerified`
  - Find the record by ID.
  - Require `status === "verified"`.
  - Update kind, amount, date, and note.
- `deleteVerified`
  - Require `status === "verified"`.
  - Remove the record.
  - Remove its fingerprint from the fingerprint index when present.

Removing the fingerprint index entry allows a deleted imported transaction to be imported again later.

### D1 adapter

#### File

`src/features/transactions/transaction.d1.ts`

Implement:

- A user-scoped `UPDATE` restricted to `status = "verified"`.
- A user-scoped `DELETE` restricted to `status = "verified"`.
- A boolean result based on whether a row was affected.

Every mutation predicate must include the transaction ID, current user ID, and verified status.

No database migration is required for permanent deletion.

## 4. Add HTTP API endpoints

### File

`src/features/transactions/transaction.routes.ts`

Add the following routes.

### Update

```http
PATCH /api/transactions/:id
```

Example body:

```json
{
  "kind": "expense",
  "amountToman": 45000,
  "occurredAt": "2026-09-19T12:30:00.000Z",
  "note": "خرید روزانه"
}
```

Successful response:

```json
{
  "status": "updated",
  "id": "..."
}
```

### Delete

```http
DELETE /api/transactions/:id
```

Successful response:

```json
{
  "status": "deleted",
  "id": "..."
}
```

Error behavior:

- Return `400` for invalid update payloads.
- Return `404` when the transaction does not exist, is not verified, or is not owned by the current user.
- Do not reveal whether an ID belongs to another user.

Reuse the existing JSON parsing and API error handling conventions.

## 5. Add client-side mutation hooks

### File

`app/src/features/transactions/api.ts`

Optionally add a focused mutations module at:

`app/src/features/transactions/mutations.ts`

Add React Query mutations for updating and deleting transactions.

On success, invalidate:

```ts
transactionKeys.all
```

This refreshes both the paginated transaction list and the home page transaction query, including monthly totals and balance calculations.

Add success and error toasts consistent with the existing manual-entry flow:

- `تراکنش ویرایش شد`
- `تراکنش حذف شد`
- `ویرایش تراکنش انجام نشد`
- `حذف تراکنش انجام نشد`

## 6. Refactor the transaction form for reuse

### Existing file

`app/src/features/transactions/manual-transaction-dialog.tsx`

The current manual form already contains most fields needed for editing but is coupled to creation. Extract the shared form into:

`app/src/features/transactions/transaction-form.tsx`

The reusable form should support:

- Create mode.
- Edit mode.
- Initial values.
- Submit label.
- Submit mutation.
- Completion callback.

Keep `ManualTransactionDialog` using the form in create mode. Add an edit dialog using the same form in edit mode.

Form details:

- Convert `amountRial` to تومان when initializing edit values.
- Convert the Jalali date-picker value back to ISO on submit.
- Reset when the selected transaction changes.
- Disable inputs while the mutation is pending.
- Close only after a successful update.

## 7. Add edit and delete controls to transaction cards

### File

`app/src/features/transactions/transactions-view.tsx`

For each transaction card:

- Add an accessible edit action.
- Add an accessible delete action.
- Preserve the current transaction information and layout.
- Do not make the whole card destructive or ambiguous.

Edit flow:

1. User selects `ویرایش`.
2. The edit dialog opens with the transaction's current values.
3. User submits the form.
4. The dialog closes after a successful update.
5. The transaction list is refreshed.

Delete flow:

1. User selects `حذف`.
2. A confirmation dialog opens.
3. The dialog explains that deletion is permanent.
4. User confirms.
5. The delete mutation runs and the list refreshes.

Use the existing dialog primitives rather than `window.confirm`, so the interaction remains consistent and accessible on mobile.

## 8. Handle pagination and derived views

Invalidate and refetch transaction queries after both mutations instead of manually patching cached pages.

This handles cases where an edited date moves a transaction into another date group or page. It also allows the next transaction to fill a deleted transaction's position naturally.

The existing home page and balance chart read from the transaction query, so invalidating `transactionKeys.all` should update:

- Monthly totals.
- Balance flow.
- Home transaction summaries.

## 9. Add tests

### Storage tests

#### File

`test/transaction-storage.test.ts`

Add coverage for:

- Updating a verified transaction.
- Refusing to update a draft.
- Refusing to update a missing transaction.
- Deleting a verified transaction.
- Ensuring deleted transactions are absent from `listVerified` and `listVerifiedPage`.
- Refusing to delete a draft.
- Allowing a deleted imported transaction's fingerprint to be imported again.

If there is an existing D1 adapter test setup, add equivalent D1 coverage for the user and status predicates.

### API tests

#### File

`test/dev-transactions-api.test.ts`

Add coverage for:

- Valid `PATCH /api/transactions/:id`.
- Updated values returned by `GET /api/transactions`.
- Valid `DELETE /api/transactions/:id`.
- Deleted values absent from the list.
- Invalid update payload returning `400`.
- Missing transaction returning `404`.
- Attempting to mutate a non-verified transaction returning `404`.

### UI tests

#### File

`test/transactions-view.test.tsx`

Extend the mocked API and add coverage for:

- Edit and delete controls appearing on transaction cards.
- The edit dialog being populated with the selected transaction.
- Submitting the edit form with the expected PATCH request.
- Displaying the delete confirmation.
- Sending the expected DELETE request after confirmation.
- Refreshing the list after a successful mutation.

If the extracted form becomes substantial, add:

`test/transaction-form.test.tsx`

### End-to-end test

If the E2E environment is available, cover this flow:

1. Create a manual transaction.
2. Open the transactions view.
3. Edit its amount or note.
4. Confirm the updated value.
5. Delete the transaction.
6. Confirm it no longer appears.

## 10. Validation

Run:

```bash
bun run typecheck
bun test
bun run build
```

If the end-to-end environment is available:

```bash
bun run test:e2e
```

Manually verify:

- Editing a transaction changes its date grouping.
- Editing a transaction updates the home balance chart.
- Deleting the only transaction shows the empty state.
- Re-importing a deleted imported transaction is allowed.
- Editing and deleting work for manual and imported verified transactions.

## Expected files

Expected existing files to change:

```text
shared/contracts/transaction.ts
src/features/transactions/transaction.storage.ts
src/features/transactions/transaction.memory.ts
src/features/transactions/transaction.d1.ts
src/features/transactions/transaction.routes.ts
app/src/features/transactions/api.ts
app/src/features/transactions/transactions-view.tsx
app/src/features/transactions/manual-transaction-dialog.tsx
test/transaction-storage.test.ts
test/dev-transactions-api.test.ts
test/transactions-view.test.tsx
```

Likely new file:

```text
app/src/features/transactions/transaction-form.tsx
```

No migration is needed for permanent deletion. If recovery, audit history, or retention requirements are added later, replace permanent deletion with a soft-delete design and add a migration plus verified-query filters.
