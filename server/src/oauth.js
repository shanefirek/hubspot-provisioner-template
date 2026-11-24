const { runProvisioning } = require('./provisioning');
const { saveTokens } = require('./lib/tokens');

const TOKEN_URL = 'https://api.hubapi.com/oauth/v1/token';

async function handleCallback(req, res) {
  const { code } = req.query;

  if (!code) {
    return res.status(400).send('Missing authorization code.');
  }

  let tokenData;
  try {
    const tokenRes = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: process.env.HUBSPOT_CLIENT_ID,
        client_secret: process.env.HUBSPOT_CLIENT_SECRET,
        redirect_uri: process.env.HUBSPOT_REDIRECT_URI,
        code,
      }),
    });

    if (!tokenRes.ok) {
      const body = await tokenRes.text();
      console.error('Token exchange failed:', body);
      return res.status(500).send(errorPage('Token exchange failed. Please try reinstalling.'));
    }

    tokenData = await tokenRes.json();
  } catch (err) {
    console.error('Token exchange error:', err);
    return res.status(500).send(errorPage('Could not reach HubSpot. Please try again.'));
  }

  const { access_token, hub_id } = tokenData;
  console.log(`App installed on portal ${hub_id}`);

  await saveTokens(tokenData);

  const results = await runProvisioning(access_token);
  const failed = results.filter((r) => !r.ok);

  if (failed.length > 0) {
    console.warn('Some provisioning steps failed:', failed);
  }

  res.send(successPage(hub_id, results));
}

function successPage(portalId, results) {
  const items = results
    .map(
      (r) =>
        `<li class="${r.ok ? 'ok' : 'fail'}">${r.ok ? '✓' : '✗'} ${r.name}${r.error ? ` — ${r.error}` : ''}</li>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>HubSpot Provisioner — Installation Complete</title>
  <style>
    body { font-family: -apple-system, sans-serif; max-width: 560px; margin: 80px auto; padding: 0 20px; color: #1a1a1a; }
    h1 { font-size: 24px; margin-bottom: 8px; }
    p { color: #555; }
    ul { list-style: none; padding: 0; margin: 24px 0; }
    li { padding: 8px 0; border-bottom: 1px solid #eee; font-size: 15px; }
    .ok { color: #1a7f37; }
    .fail { color: #cf222e; }
    small { color: #888; }
  </style>
</head>
<body>
  <h1>✓ Installation complete</h1>
  <p>Portal <strong>${portalId}</strong> has been provisioned with your standard configuration.</p>
  <ul>${items}</ul>
  <small>You can close this window and return to HubSpot.</small>
</body>
</html>`;
}

function errorPage(message) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>HubSpot Provisioner — Installation Error</title>
  <style>
    body { font-family: -apple-system, sans-serif; max-width: 560px; margin: 80px auto; padding: 0 20px; color: #1a1a1a; }
    h1 { color: #cf222e; }
  </style>
</head>
<body>
  <h1>Installation failed</h1>
  <p>${message}</p>
</body>
</html>`;
}

module.exports = { handleCallback };
