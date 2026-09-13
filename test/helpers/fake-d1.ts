import type { D1Database } from "@cloudflare/workers-types";

export type RecordedStatement = { sql: string; params: unknown[] };
type Row = Record<string, unknown>;

// Minimal D1 stand-in for the storage adapters. Drizzle's D1 driver reads via
// `raw()`, so selects return positional column arrays; writes are matched to
// their table by SQL. Good enough to run the shared storage conformance suite
// and to assert statement shapes.
export function createFakeD1() {
  const tables: Record<string, Row[]> = { chat_messages: [], conversations: [] };
  const statements: RecordedStatement[] = [];

  function applyInsert(sql: string, params: unknown[]) {
    const match = sql.match(/insert\s+into\s+"?([a-z_]+)"?\s*\(([^)]*)\)\s*values/i);
    if (!match) return;
    const [, table, columnList] = match;
    const columns = [...columnList.matchAll(/"([a-z_]+)"/g)].map((m) => m[1]);
    if (columns.length === 0) return;
    for (let start = 0; start < params.length; start += columns.length) {
      const row: Row = {};
      columns.forEach((column, index) => {
        row[column] = params[start + index];
      });
      (tables[table] ??= []).push(row);
    }
  }

  function applyDelete(sql: string, params: unknown[]) {
    const match = sql.match(/delete\s+from\s+"?([a-z_]+)"?/i);
    if (!match) return;
    const table = match[1];
    const where = sql.split(/\bwhere\b/i)[1] ?? "";
    const equals = [...where.matchAll(/"([a-z_]+)"\s*=\s*\?/g)].map((m, index) => ({ column: m[1], value: params[index] }));
    const inColumn = where.match(/"([a-z_]+)"\s+in\s+\(/i)?.[1];
    const inValues = inColumn ? params.slice(equals.length).map(String) : [];
    tables[table] = (tables[table] ?? []).filter((row) => {
      const matchesScope = equals.every(({ column, value }) => String(row[column]) === String(value));
      if (!matchesScope) return true;
      if (inColumn) return !inValues.includes(String(row[inColumn]));
      return false;
    });
  }

  function applySelect(sql: string, params: unknown[]): unknown[][] {
    const match = sql.match(/select\s+(.*?)\s+from\s+"?([a-z_]+)"?/is);
    if (!match) return [];
    const [, selectList, table] = match;
    const columns = [...selectList.matchAll(/"([a-z_]+)"/g)].map((m) => m[1]);
    const where = sql.split(/\bwhere\b/i)[1]?.split(/\border by\b/i)[0] ?? "";
    const equals = [...where.matchAll(/"([a-z_]+)"\s*=\s*\?/g)].map((m, index) => ({ column: m[1], value: params[index] }));
    return (tables[table] ?? [])
      .filter((row) => equals.every(({ column, value }) => String(row[column]) === String(value)))
      .map((row) => columns.map((column) => row[column]));
  }

  const binding = {
    prepare: (sql: string) => ({
      bind: (...params: unknown[]) => ({
        run: async () => {
          statements.push({ sql, params });
          if (/^\s*insert/i.test(sql)) applyInsert(sql, params);
          else if (/^\s*delete/i.test(sql)) applyDelete(sql, params);
          return { success: true, meta: {} };
        },
        all: async () => {
          statements.push({ sql, params });
          return { results: [] };
        },
        first: async () => null,
        raw: async () => {
          statements.push({ sql, params });
          return applySelect(sql, params);
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

  return { binding: binding as unknown as D1Database, statements, tables };
}
