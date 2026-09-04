import { ApiError } from "@shared/contracts/api";

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...init, headers: { "content-type": "application/json", ...(init?.headers ?? {}) } });
  const payload = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) throw new ApiError(response.status, payload.error ?? "درخواست انجام نشد");
  return payload as T;
}
