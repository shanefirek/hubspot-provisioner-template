const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function init() {
  await pool.query('SELECT 1');
  console.log('[db] connected');
}

async function upsertTokens({ portalId, accessToken, refreshToken, expiresIn }) {
  const expiresAt = new Date(Date.now() + expiresIn * 1000);
  await pool.query(
    `INSERT INTO portal_tokens (portal_id, access_token, refresh_token, expires_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (portal_id) DO UPDATE SET
       access_token  = EXCLUDED.access_token,
       refresh_token = EXCLUDED.refresh_token,
       expires_at    = EXCLUDED.expires_at,
       updated_at    = NOW()`,
    [portalId, accessToken, refreshToken, expiresAt]
  );
}

async function getTokenRecord(portalId) {
  const { rows } = await pool.query(
    'SELECT * FROM portal_tokens WHERE portal_id = $1',
    [portalId]
  );
  return rows[0] || null;
}

module.exports = { init, upsertTokens, getTokenRecord };
