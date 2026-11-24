const { upsertTokens, getTokenRecord } = require('./db');

const TOKEN_URL = 'https://api.hubapi.com/oauth/v1/token';
const REFRESH_BUFFER_MS = 60_000; // refresh 60s before expiry

async function saveTokens({ access_token, refresh_token, expires_in, hub_id }) {
  await upsertTokens({
    portalId: hub_id,
    accessToken: access_token,
    refreshToken: refresh_token,
    expiresIn: expires_in,
  });
  console.log(`[tokens] saved for portal ${hub_id}`);
}

// Returns a valid access token, refreshing automatically if expired.
async function getValidToken(portalId) {
  const record = await getTokenRecord(portalId);
  if (!record) throw new Error(`No tokens found for portal ${portalId}`);

  const isExpired = new Date(record.expires_at) < new Date(Date.now() + REFRESH_BUFFER_MS);
  if (!isExpired) return record.access_token;

  console.log(`[tokens] access token expired for portal ${portalId}, refreshing...`);
  return refreshAccessToken(portalId, record.refresh_token);
}

async function refreshAccessToken(portalId, refreshToken) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: process.env.HUBSPOT_CLIENT_ID,
      client_secret: process.env.HUBSPOT_CLIENT_SECRET,
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) throw new Error(`Token refresh failed: ${await res.text()}`);

  const tokenData = await res.json();
  await upsertTokens({
    portalId,
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token,
    expiresIn: tokenData.expires_in,
  });

  console.log(`[tokens] refreshed for portal ${portalId}`);
  return tokenData.access_token;
}

module.exports = { saveTokens, getValidToken };
