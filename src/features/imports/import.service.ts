import { clipboardImportSchema } from "../../../shared/contracts/transaction";
import { containsSensitiveCode, parseSms } from "../../../shared/parsing/sms";
import type { TransactionStorage } from "../transactions/transaction.storage";

async function fingerprint(text: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

// Clipboard import: block sensitive messages, parse the SMS deterministically,
// and persist a draft through the storage port. The port owns deduplication; the
// service owns the parser and the client-facing status vocabulary.
export async function importClipboard(storage: TransactionStorage, input: unknown) {
  const { text } = clipboardImportSchema.parse(input);
  if (containsSensitiveCode(text)) return { status: "sensitive_blocked" as const };
  const parsed = parseSms(text);
  const result = await storage.createDraft({
    id: crypto.randomUUID(),
    source: "clipboard",
    kind: parsed.kind,
    amountRial: parsed.amountRial,
    occurredAt: parsed.occurredAt ?? new Date().toISOString(),
    sourceDateText: parsed.sourceDateText,
    dateWasInferred: parsed.occurredAt == null,
    bankId: parsed.bankId,
    accountId: parsed.accountId,
    balanceAfterRial: parsed.balanceAfterRial,
    originalMessage: text,
    fingerprint: await fingerprint(text),
    extractionMeta: JSON.stringify({ parser: "bank_rules_v2" }),
  });
  return result.status === "duplicate" ? { status: "duplicate" as const } : { status: "draft_created" as const, id: result.id };
}
