import type { Database } from "../../infrastructure/db/client";
import { json } from "../../shared/http";
import { importClipboard } from "./import.service";

export async function importRoutes(request: Request, path: string, db: Database) {
  if (path !== "/api/imports/clipboard" || request.method !== "POST") return null;
  const result = await importClipboard(db, await request.json());
  return json(result, { status: result.status === "draft_created" ? 201 : 200 });
}
