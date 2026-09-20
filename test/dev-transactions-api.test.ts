import { describe, expect, it, vi } from "vitest";
import type { IncomingMessage, ServerResponse } from "node:http";

async function createHandler() {
  vi.resetModules();
  const { devApi: freshDevApi } = await import("../scripts/dev-api");
  let handler: ((request: IncomingMessage, response: ServerResponse, next: () => void) => Promise<void> | void) | undefined;
  freshDevApi({ aiApiKey: "test-key" }).configureServer({
    middlewares: { use: (fn: typeof handler) => { handler = fn; } },
  } as never);
  if (!handler) throw new Error("middleware was not registered");
  return (request: IncomingMessage, response: ServerResponse) => handler!(request, response, () => {});
}

function fakeRequest(url: string, method: string, body?: unknown): IncomingMessage {
  const chunks = body === undefined ? [] : [JSON.stringify(body)];
  return {
    url,
    method,
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) yield chunk;
    },
  } as unknown as IncomingMessage;
}

function fakeResponse() {
  const chunks: Buffer[] = [];
  const state = { statusCode: 200, ended: false };
  const response = {
    get statusCode() {
      return state.statusCode;
    },
    set statusCode(value: number) {
      state.statusCode = value;
    },
    setHeader: () => {},
    write: (chunk: Buffer) => {
      chunks.push(Buffer.from(chunk));
    },
    end: (chunk?: Buffer) => {
      if (chunk) chunks.push(Buffer.from(chunk));
      state.ended = true;
    },
  } as unknown as ServerResponse;
  return { response, status: () => state.statusCode, body: () => Buffer.concat(chunks).toString("utf8") };
}

async function seedManual(handle: (request: IncomingMessage, response: ServerResponse) => Promise<void> | void, occurredAt: string) {
  const response = fakeResponse();
  await handle(fakeRequest("/api/transactions/manual", "POST", { kind: "expense", amountToman: 1000, occurredAt, note: "" }), response.response);
  const { id } = JSON.parse(response.body()) as { id: string };
  return { id, occurredAt };
}

describe("dev api transactions pagination", () => {
  it("returns the full list when no limit is requested", async () => {
    const handle = await createHandler();
    const oldest = await seedManual(handle, "2024-05-01T10:00:00.000Z");
    const middle = await seedManual(handle, "2024-05-02T10:00:00.000Z");
    const newest = await seedManual(handle, "2024-05-03T10:00:00.000Z");

    const response = fakeResponse();
    await handle(fakeRequest("/api/transactions", "GET"), response.response);
    expect(response.status()).toBe(200);
    const payload = JSON.parse(response.body());
    expect(payload.transactions.map((item: { id: string }) => item.id)).toEqual([newest.id, middle.id, oldest.id]);
    expect(payload.nextCursor).toBeNull();
  });

  it("pages through transactions with a keyset cursor in (occurredAt, id) order", async () => {
    const handle = await createHandler();
    await seedManual(handle, "2024-05-01T10:00:00.000Z");
    const middle = await seedManual(handle, "2024-05-02T10:00:00.000Z");
    const newest = await seedManual(handle, "2024-05-03T10:00:00.000Z");

    const first = fakeResponse();
    await handle(fakeRequest("/api/transactions?limit=2", "GET"), first.response);
    const firstPayload = JSON.parse(first.body());
    expect(firstPayload.transactions).toHaveLength(2);
    expect(firstPayload.transactions[0].id).toBe(newest.id);
    expect(firstPayload.transactions[1].id).toBe(middle.id);
    expect(firstPayload.nextCursor).toBe(`${middle.occurredAt}|${middle.id}`);

    const second = fakeResponse();
    await handle(fakeRequest(`/api/transactions?limit=2&cursor=${encodeURIComponent(firstPayload.nextCursor)}`, "GET"), second.response);
    const secondPayload = JSON.parse(second.body());
    expect(secondPayload.transactions).toHaveLength(1);
    expect(secondPayload.nextCursor).toBeNull();
  });

  it("rejects an invalid limit or cursor", async () => {
    const handle = await createHandler();
    const badLimit = fakeResponse();
    await handle(fakeRequest("/api/transactions?limit=0", "GET"), badLimit.response);
    expect(badLimit.status()).toBe(400);

    const hugeLimit = fakeResponse();
    await handle(fakeRequest("/api/transactions?limit=101", "GET"), hugeLimit.response);
    expect(hugeLimit.status()).toBe(400);

    const badCursor = fakeResponse();
    await handle(fakeRequest("/api/transactions?limit=2&cursor=garbage", "GET"), badCursor.response);
    expect(badCursor.status()).toBe(400);
  });

  it("updates and deletes a verified transaction", async () => {
    const handle = await createHandler();
    const seeded = await seedManual(handle, "2024-05-01T10:00:00.000Z");

    const update = fakeResponse();
    await handle(fakeRequest(`/api/transactions/${seeded.id}`, "PATCH", {
      kind: "income",
      amountToman: 2500,
      occurredAt: "2024-05-02T10:00:00.000Z",
      note: "حقوق",
    }), update.response);
    expect(update.status()).toBe(200);
    expect(JSON.parse(update.body())).toEqual({ status: "updated", id: seeded.id });

    const listed = fakeResponse();
    await handle(fakeRequest("/api/transactions", "GET"), listed.response);
    expect(JSON.parse(listed.body()).transactions).toMatchObject([{ id: seeded.id, kind: "income", amountRial: 25000, userNote: "حقوق", occurredAt: "2024-05-02T10:00:00.000Z" }]);

    const deletion = fakeResponse();
    await handle(fakeRequest(`/api/transactions/${seeded.id}`, "DELETE"), deletion.response);
    expect(deletion.status()).toBe(200);
    expect(JSON.parse(deletion.body())).toEqual({ status: "deleted", id: seeded.id });

    const missing = fakeResponse();
    await handle(fakeRequest(`/api/transactions/${seeded.id}`, "DELETE"), missing.response);
    expect(missing.status()).toBe(404);
  });

  it("validates transaction updates and returns not found for unknown IDs", async () => {
    const handle = await createHandler();
    const invalid = fakeResponse();
    await handle(fakeRequest("/api/transactions/missing", "PATCH", { kind: "expense", amountToman: 0, occurredAt: "bad", note: "" }), invalid.response);
    expect(invalid.status()).toBe(400);

    const missing = fakeResponse();
    await handle(fakeRequest("/api/transactions/missing", "PATCH", { kind: "expense", amountToman: 1000, occurredAt: "2024-05-01T10:00:00.000Z", note: "" }), missing.response);
    expect(missing.status()).toBe(404);
  });
});
