/**
 * Test environment helpers.
 *
 * Strategy:
 *   - Prefer better-sqlite3 in-memory DB wrapped with a D1Database-compatible
 *     façade for unit tests of repositories.
 *   - Provide trivial in-process mocks for R2 and KV.
 *   - For tests that exercise only service-level logic (most of our RED
 *     tests), we can construct the services with the real (stub) impls and
 *     pass these mocks where needed.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Lazily import better-sqlite3 so unit-only tests don't load it.
type BetterSqliteDatabase = any;

export interface TestEnv {
  /** D1-compatible facade backed by better-sqlite3 in-memory. */
  db: D1Database;
  /** In-memory R2-like bucket. */
  bucket: R2Bucket;
  /** In-memory KV namespace. */
  kv: KVNamespace;
  /** Underlying sqlite handle for direct setup in tests. */
  raw: BetterSqliteDatabase;
}

/**
 * Build an in-memory test env with the schema applied.
 * Skips silently with a clear error if better-sqlite3 is unavailable.
 */
export async function createTestEnv(): Promise<TestEnv> {
  let Database: any;
  try {
    Database = (await import("better-sqlite3")).default;
  } catch (e) {
    throw new Error(
      "better-sqlite3 is required for repository/integration tests. Install devDependency and rerun.",
    );
  }
  const raw: BetterSqliteDatabase = new Database(":memory:");
  raw.pragma("journal_mode = MEMORY");
  raw.pragma("foreign_keys = ON");
  const sql = readFileSync(
    resolve(__dirname, "../../migrations/0001_init.sql"),
    "utf8",
  );
  raw.exec(sql);

  const db: D1Database = wrapSqliteAsD1(raw);
  const bucket: R2Bucket = createMockR2();
  const kv: KVNamespace = createMockKv();
  return { db, bucket, kv, raw };
}

/* ---------- D1 façade over better-sqlite3 (minimal subset) ---------- */
function wrapSqliteAsD1(raw: BetterSqliteDatabase): D1Database {
  const prepare = (sql: string) => {
    const stmt = raw.prepare(sql);
    let binds: unknown[] = [];
    const api: any = {
      bind(...args: unknown[]) {
        binds = args;
        return api;
      },
      async first<T = unknown>(_col?: string): Promise<T | null> {
        const row = stmt.get(...binds);
        return (row ?? null) as T | null;
      },
      async all<T = unknown>(): Promise<{ results: T[] }> {
        const rows = stmt.all(...binds);
        return { results: rows as T[] };
      },
      async run(): Promise<{ meta: { changes: number; last_row_id: number } }> {
        const r = stmt.run(...binds);
        return { meta: { changes: r.changes, last_row_id: Number(r.lastInsertRowid) } } as any;
      },
      async raw(): Promise<unknown[][]> {
        const rows = stmt.raw().all(...binds);
        return rows as unknown[][];
      },
    };
    return api;
  };

  return {
    prepare,
    async exec(sql: string) {
      raw.exec(sql);
      return { count: 0, duration: 0 } as any;
    },
    async batch(statements: any[]) {
      const results: any[] = [];
      for (const s of statements) results.push(await s.run());
      return results;
    },
    async dump() {
      return new ArrayBuffer(0);
    },
  } as unknown as D1Database;
}

/* ---------- R2 mock ---------- */
function createMockR2(): R2Bucket {
  const store = new Map<string, Uint8Array>();
  return {
    async put(key: string, value: any) {
      const buf =
        value instanceof Uint8Array
          ? value
          : new Uint8Array(value as ArrayBuffer);
      store.set(key, buf);
      return {} as any;
    },
    async get(key: string) {
      const v = store.get(key);
      if (!v) return null;
      return {
        body: null,
        async arrayBuffer() {
          return v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength);
        },
        async text() {
          return new TextDecoder().decode(v);
        },
      } as any;
    },
    async delete(key: string) {
      store.delete(key);
    },
    async head(key: string) {
      return store.has(key) ? ({} as any) : null;
    },
    async list() {
      return { objects: [...store.keys()].map((k) => ({ key: k })) } as any;
    },
  } as unknown as R2Bucket;
}

/* ---------- KV mock ---------- */
function createMockKv(): KVNamespace {
  const store = new Map<string, string>();
  return {
    async get(key: string, _type?: any) {
      return store.get(key) ?? null;
    },
    async put(key: string, value: string) {
      store.set(key, value);
    },
    async delete(key: string) {
      store.delete(key);
    },
    async list() {
      return {
        keys: [...store.keys()].map((name) => ({ name })),
        list_complete: true,
      } as any;
    },
  } as unknown as KVNamespace;
}
