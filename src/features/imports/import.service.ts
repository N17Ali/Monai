import { clipboardImportSchema } from "../../../shared/contracts/transaction";
import { containsSensitiveCode, parseSms } from "../../../shared/parsing/sms";
import type { Database } from "../../infrastructure/db/client";
import { transactionRepository, USER_ID } from "../transactions/transaction.repository";

async function fingerprint(text: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function importClipboard(db: Database, input: unknown) {
  const { text } = clipboardImportSchema.parse(input);
  if (containsSensitiveCode(text)) return { status: "sensitive_blocked" as const };
  const parsed = parseSms(text);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const occurredAt = parsed.occurredAt ?? now;
  try {
    await transactionRepository(db).insert({
      id,
      userId: USER_ID,
      source: "clipboard",
      status: "needs_review",
      kind: parsed.kind,
      amountRial: parsed.amountRial,
      occurredAt,
      sourceDateText: parsed.sourceDateText,
      dateWasInferred: parsed.occurredAt == null,
      bankId: parsed.bankId,
      accountId: parsed.accountId,
      balanceAfterRial: parsed.balanceAfterRial,
      originalMessage: text,
      fingerprint: await fingerprint(text),
      extractionMeta: JSON.stringify({ parser: "bank_rules_v2" }),
      createdAt: now,
    });
    return { status: "draft_created" as const, id };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/unique constraint|constraint failed/i.test(message)) return { status: "duplicate" as const };
    throw error;
  }
}
