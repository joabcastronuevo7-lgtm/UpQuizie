import pg from "pg";

const { Pool } = pg;

export const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    "postgres://upquizie:upquizie@postgres:5432/examdb",
});

export async function query<T = any>(text: string, params: any[] = []): Promise<T[]> {
  const res = await pool.query(text, params);
  return res.rows as T[];
}

// Ensure the async-generation job table exists (works on already-initialized DBs
// where the init SQL has already run).
export async function ensureSchema(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS generation_jobs (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      subject_id  UUID,
      status      TEXT NOT NULL DEFAULT 'running',
      requested   INT  NOT NULL DEFAULT 0,
      generated   INT  NOT NULL DEFAULT 0,
      error       TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      finished_at TIMESTAMPTZ
    )
  `);
}
