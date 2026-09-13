import { json } from "../../shared/http";
import type { TransactionStorage } from "../transactions/transaction.storage";
import { importClipboard } from "./import.service";

export function createImportRoutes(storage: TransactionStorage) {
  return async function importRoutes(request: Request, path: string): Promise<Response | null> {
    if (path !== "/api/imports/clipboard" || request.method !== "POST") return null;
    const result = await importClipboard(storage, await request.json());
    return json(result, { status: result.status === "draft_created" ? 201 : 200 });
  };
}
