require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Add new migrations here in order. Never edit or remove existing entries.
const MIGRATIONS = [
  {
    version: 1,
    name: 'create_portal_tokens',
    sql: `
      CREATE TABLE IF NOT EXISTS portal_tokens (
        portal_id     BIGINT PRIMARY KEY,
        access_token  TEXT        NOT NULL,
        refresh_token TEXT        NOT NULL,
        expires_at    TIMESTAMPTZ NOT NULL,
        installed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `,
  },
];

async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    INT         PRIMARY KEY,
      name       TEXT        NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const { rows } = await pool.query(
    'SELECT version FROM schema_migrations ORDER BY version'
  );
  const applied = new Set(rows.map((r) => r.version));
  const pending = MIGRATIONS.filter((m) => !applied.has(m.version));

  if (pending.length === 0) {
    console.log('[migrate] schema is up to date');
    return;
  }

  for (const m of pending) {
    console.log(`[migrate] applying ${m.version}: ${m.name}`);
    await pool.query('BEGIN');
    try {
      await pool.query(m.sql);
      await pool.query(
        'INSERT INTO schema_migrations (version, name) VALUES ($1, $2)',
        [m.version, m.name]
      );
      await pool.query('COMMIT');
      console.log(`[migrate] ✓ ${m.version}: ${m.name}`);
    } catch (err) {
      await pool.query('ROLLBACK');
      throw err;
    }
  }
}

migrate()
  .then(() => pool.end())
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[migrate] failed:', err.message);
    process.exit(1);
  });
