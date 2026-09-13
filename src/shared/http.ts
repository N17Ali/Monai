import { ZodError } from "zod";
import { ApiError } from "../../shared/contracts/api";

export function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, {
    ...init,
    headers: { "content-type": "application/json; charset=utf-8", ...(init?.headers ?? {}) },
  });
}

export async function parseJson<T>(request: Request, schema: { parse: (value: unknown) => T }) {
  try {
    return schema.parse(await request.json());
  } catch {
    throw new ApiError(400, "اطلاعات ارسالی معتبر نیست");
  }
}

export function apiError(error: unknown) {
  if (error instanceof ApiError) return json({ error: error.message }, { status: error.status });
  if (error instanceof ZodError) return json({ error: "اطلاعات ارسالی معتبر نیست" }, { status: 400 });
  return json({ error: "خطای داخلی سرور" }, { status: 500 });
}
