require('dotenv').config();
const express = require('express');
const { init: initDb } = require('./lib/db');
const { handleCallback } = require('./oauth');
const portalsRouter = require('./routes/portals');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/oauth/callback', handleCallback);
app.use('/api/portals', portalsRouter);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

initDb()
  .then(() => app.listen(PORT, () => console.log(`Server listening on port ${PORT}`)))
  .catch((err) => { console.error('[db] init failed:', err); process.exit(1); });
