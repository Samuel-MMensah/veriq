// A small stand-in for the supabase-js query builder, backed by PGlite. It supports only the
// calls the app makes (select *, insert, eq, in, gte, lte, order, maybeSingle, single, and rpc) and returns
// values the way PostgREST does: timestamps as ISO strings, numerics as numbers.
// Used by tests and by local data mode (VERIQ_DATA=local).
import type { PGlite } from "@electric-sql/pglite";
import type { Db } from "@/lib/db/supabase";

const NUMERIC = 1700;
const DATE = 1082;
const TIMESTAMPTZ = 1184;

type Filter = { sql: string; values: unknown[] };
type Result = { data: unknown; error: { message: string } | null };

/**
 * "owner" runs as the table owner, like the service role (row-level security does not apply).
 * "anon" runs each statement as the anon role, like the public API key.
 */
export type FakeRole = "owner" | "anon";

async function run(db: PGlite, role: FakeRole, sql: string, values: unknown[]) {
  if (role === "owner") return db.query<Record<string, unknown>>(sql, values);
  return db.transaction(async (tx) => {
    await tx.exec("set local role anon");
    return tx.query<Record<string, unknown>>(sql, values);
  });
}

class Query implements PromiseLike<Result> {
  private filters: Filter[] = [];
  private orderBy: string | null = null;
  private oneRow = false;
  private strictSingle = false;
  private row: Record<string, unknown> | null = null;

  constructor(
    private db: PGlite,
    private role: FakeRole,
    private table: string,
  ) {}

  select(columns: string) {
    if (columns !== "*") throw new Error("fake-postgrest supports select('*') only");
    return this;
  }
  eq(column: string, value: unknown) {
    return this.add(`${ident(column)} = $?`, [value]);
  }
  gte(column: string, value: unknown) {
    return this.add(`${ident(column)} >= $?`, [value]);
  }
  lte(column: string, value: unknown) {
    return this.add(`${ident(column)} <= $?`, [value]);
  }
  in(column: string, values: unknown[]) {
    if (values.length === 0) return this.add("false", []);
    return this.add(`${ident(column)} in (${values.map(() => "$?").join(", ")})`, values);
  }
  order(column: string, opts?: { ascending?: boolean }) {
    this.orderBy = `${ident(column)} ${opts?.ascending === false ? "desc" : "asc"}`;
    return this;
  }
  maybeSingle() {
    this.oneRow = true;
    return this;
  }
  single() {
    this.oneRow = true;
    this.strictSingle = true;
    return this;
  }
  insert(row: Record<string, unknown>) {
    this.row = row;
    return this;
  }

  private add(sql: string, values: unknown[]) {
    this.filters.push({ sql, values });
    return this;
  }

  private async run() {
    const values: unknown[] = [];
    const where = this.filters
      .map((f) => {
        let i = 0;
        return f.sql.replace(/\$\?/g, () => {
          values.push(f.values[i++]);
          return `$${values.length}`;
        });
      })
      .join(" and ");
    let sql = `select * from public.${ident(this.table)}${where ? ` where ${where}` : ""}${
      this.orderBy ? ` order by ${this.orderBy}` : ""
    }`;
    if (this.row) {
      const cols = Object.keys(this.row);
      values.push(...cols.map((c) => this.row![c]));
      sql = `insert into public.${ident(this.table)} (${cols.map(ident).join(", ")}) values (${cols
        .map((_, i) => `$${i + 1}`)
        .join(", ")}) returning *`;
    }
    try {
      const res = await run(this.db, this.role, sql, values);
      const rows = res.rows.map((row) => {
        const out: Record<string, unknown> = {};
        for (const field of res.fields) {
          const v = row[field.name];
          if (v === null || v === undefined) out[field.name] = null;
          else if (field.dataTypeID === NUMERIC) out[field.name] = Number(v);
          else if (field.dataTypeID === DATE) out[field.name] = v instanceof Date ? v.toISOString().slice(0, 10) : v;
          else if (field.dataTypeID === TIMESTAMPTZ) out[field.name] = v instanceof Date ? v.toISOString() : v;
          else out[field.name] = v;
        }
        return out;
      });
      if (this.oneRow) {
        if (rows.length > 1) return { data: null, error: { message: "More than one row" } };
        if (this.strictSingle && rows.length === 0) return { data: null, error: { message: "No row" } };
        return { data: rows[0] ?? null, error: null };
      }
      return { data: rows, error: null };
    } catch (e) {
      return { data: null, error: { message: (e as Error).message } };
    }
  }

  then<A, B>(
    onfulfilled?: ((v: Result) => A | PromiseLike<A>) | null,
    onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    return this.run().then(onfulfilled, onrejected);
  }
}

function ident(name: string): string {
  if (!/^[a-z_]+$/.test(name)) throw new Error(`Bad identifier: ${name}`);
  return `"${name}"`;
}

async function rpc(db: PGlite, role: FakeRole, fn: string, args: Record<string, unknown> = {}): Promise<Result> {
  const names = Object.keys(args);
  const sql = `select public.${ident(fn)}(${names.map((n, i) => `${ident(n)} => $${i + 1}`).join(", ")}) as result`;
  try {
    const res = await run(db, role, sql, names.map((n) => args[n]));
    return { data: res.rows[0]?.result ?? null, error: null };
  } catch (e) {
    return { data: null, error: { message: (e as Error).message } };
  }
}

export function fakeDb(db: PGlite, role: FakeRole = "owner"): Db {
  return {
    from: (table: string) => new Query(db, role, table),
    rpc: (fn: string, args?: Record<string, unknown>) => rpc(db, role, fn, args),
  } as unknown as Db;
}
