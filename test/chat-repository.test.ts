import { describe, expect, it } from "vitest";
import type { D1Database } from "@cloudflare/workers-types";
import type { UIMessage } from "ai";
import { createDb } from "../src/infrastructure/db/client";
import { chatRepository } from "../src/features/chat/chat.repository";

const INSERT_COLUMNS = 6; // id, user_id, conversation_id, role, parts, created_at

type RecordedStatement = { sql: string; params: unknown[] };
type FakeRow = { id: string; user_id: string; conversation_id: string; role: string; parts: string; created_at: string };

function message(id: string): UIMessage {
  return { id, role: "user", parts: [{ type: "text", text: `پیام ${id}` }] };
}

function createFakeD1() {
  const rows: FakeRow[] = [];
  const statements: RecordedStatement[] = [];

  function applyWrite(sql: string, params: unknown[]) {
    if (/^\s*insert/i.test(sql)) {
      for (let start = 0; start < params.length; start += INSERT_COLUMNS) {
        rows.push({
          id: String(params[start]),
          user_id: String(params[start + 1]),
          conversation_id: String(params[start + 2]),
          role: String(params[start + 3]),
          parts: String(params[start + 4]),
          created_at: String(params[start + 5]),
        });
      }
    }
    if (/^\s*delete/i.test(sql)) {
      const ids = params.slice(2).map(String);
      for (let index = rows.length - 1; index >= 0; index -= 1) {
        if (rows[index].conversation_id === String(params[1]) && ids.includes(rows[index].id)) rows.splice(index, 1);
      }
    }
  }

  const binding = {
    prepare: (sql: string) => ({
      bind: (...params: unknown[]) => ({
        run: async () => {
          statements.push({ sql, params });
          applyWrite(sql, params);
          return { success: true, meta: {} };
        },
        all: async () => {
          statements.push({ sql, params });
          return { results: [] };
        },
        first: async () => null,
        raw: async () => {
          statements.push({ sql, params });
          if (/^\s*select/i.test(sql)) {
            return rows.filter((row) => row.conversation_id === String(params[1])).map((row) => [row.id]);
          }
          return [];
        },
      }),
    }),
    batch: async (bound: Array<{ run: () => Promise<unknown> }>) => {
      const results: unknown[] = [];
      for (const statement of bound) results.push(await statement.run());
      return results;
    },
    exec: async () => {},
  };
  return { binding: binding as unknown as D1Database, statements, rows };
}

function createRepository() {
  const fake = createFakeD1();
  return { repository: chatRepository(createDb(fake.binding)), statements: fake.statements, rows: fake.rows };
}

function insertStatements(statements: RecordedStatement[]) {
  return statements.filter((statement) => /^\s*insert/i.test(statement.sql));
}

function insertedIds(statements: RecordedStatement[]) {
  return insertStatements(statements).flatMap((statement) => {
    const ids: string[] = [];
    for (let start = 0; start < statement.params.length; start += INSERT_COLUMNS) ids.push(String(statement.params[start]));
    return ids;
  });
}

describe("chat repository D1 saves", () => {
  it("keeps every insert statement within D1's 100 bound-parameter limit", async () => {
    const { repository, statements } = createRepository();
    await repository.save(Array.from({ length: 20 }, (_, index) => message(`m${index}`)));
    const inserts = insertStatements(statements);
    expect(inserts.length).toBeGreaterThan(0);
    for (const insert of inserts) {
      expect(
        insert.params.length,
        `insert with ${insert.params.length} params exceeds D1's 100 bound-parameter limit`,
      ).toBeLessThanOrEqual(100);
    }
  });

  it("still persists every message across the chunked inserts and skips the trim when nothing is stale", async () => {
    const { repository, statements } = createRepository();
    await repository.save(Array.from({ length: 20 }, (_, index) => message(`m${index}`)));
    const insertedRows = insertStatements(statements).reduce((count, insert) => count + insert.params.length / INSERT_COLUMNS, 0);
    expect(insertedRows).toBe(20);
    expect(statements.some((statement) => /^\s*delete/i.test(statement.sql))).toBe(false);
  });

  it("uses a single insert for histories that fit one statement", async () => {
    const { repository, statements } = createRepository();
    await repository.save(Array.from({ length: 5 }, (_, index) => message(`m${index}`)));
    const inserts = insertStatements(statements);
    expect(inserts).toHaveLength(1);
    expect(inserts[0].params.length).toBe(5 * INSERT_COLUMNS);
  });

  it("writes only messages that are not stored yet", async () => {
    const { repository, statements } = createRepository();
    const existing = Array.from({ length: 10 }, (_, index) => message(`m${index}`));
    await repository.save(existing);
    statements.length = 0;

    await repository.save([...existing, message("new-1"), message("new-2")]);

    expect(insertedIds(statements)).toEqual(["new-1", "new-2"]);
    expect(statements.some((statement) => /^\s*delete/i.test(statement.sql))).toBe(false);
  });

  it("supports history windows beyond the D1 per-statement limits", async () => {
    const { repository, statements, rows } = createRepository();
    const first = Array.from({ length: 150 }, (_, index) => message(`m${index}`));
    await repository.save(first, "conversation-1", 150);

    expect(statements.length).toBeGreaterThan(0);
    for (const statement of statements) {
      expect(
        statement.params.length,
        `statement with ${statement.params.length} params exceeds D1's 100 bound-parameter limit`,
      ).toBeLessThanOrEqual(100);
    }
    expect(rows).toHaveLength(150);

    statements.length = 0;
    const grown = [...first, ...Array.from({ length: 10 }, (_, index) => message(`x${index}`))];
    await repository.save(grown, "conversation-1", 150);

    expect(insertedIds(statements)).toEqual(Array.from({ length: 10 }, (_, index) => `x${index}`));
    expect(rows.map((row) => row.id)).toHaveLength(150);
    expect(rows[0]?.id).toBe("m10");
    for (const statement of statements) {
      expect(statement.params.length).toBeLessThanOrEqual(100);
    }
  });

  it("trims the stored window to the most recent messages", async () => {
    const { repository, rows } = createRepository();
    const firstTurn = Array.from({ length: 40 }, (_, index) => message(`a${index}`));
    await repository.save(firstTurn);
    const secondTurn = Array.from({ length: 20 }, (_, index) => message(`b${index}`));
    await repository.save([...firstTurn, ...secondTurn]);

    const storedIds = rows.map((row) => row.id);
    expect(storedIds).toHaveLength(50);
    expect(storedIds.slice(0, 5)).toEqual(["a10", "a11", "a12", "a13", "a14"]);
    expect(storedIds.at(-1)).toBe("b19");
  });
});
