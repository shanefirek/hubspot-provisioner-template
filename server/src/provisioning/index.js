const { createClient } = require('../lib/hubspot');
const { createLists } = require('./lists');
const { createProperties } = require('./properties');
const { ensureLeadStatusOptions } = require('./lead-status-options');
const { createWorkflows } = require('./workflows');

// Steps run in order. Each step receives (client, accessToken, ctx) and may
// return an object that is merged into ctx for subsequent steps to consume.
//
// Dependency notes:
//   - Lists reference custom properties (e.g. dnc_status) → Properties must run first
//   - Workflows reference lead status values → Lead Status Options must run first
//   - Workflows + Lists both reference custom properties → Properties must run first
const STEPS = [
  { name: 'Properties', fn: createProperties },
  { name: 'Lead Status Options', fn: ensureLeadStatusOptions },
  { name: 'Lists', fn: createLists },
  { name: 'Workflows', fn: createWorkflows },
];

async function runProvisioning(accessToken) {
  const client = createClient(accessToken);
  const ctx = {};
  const results = [];

  for (const step of STEPS) {
    try {
      const stepResult = await step.fn(client, accessToken, ctx);
      if (stepResult && typeof stepResult === 'object') Object.assign(ctx, stepResult);
      results.push({ name: step.name, ok: true });
      console.log(`[provisioning] ${step.name}: done`);
    } catch (err) {
      results.push({ name: step.name, ok: false, error: err.message });
      console.error(`[provisioning] ${step.name}: failed —`, err.message);
    }
  }

  return results;
}

module.exports = { runProvisioning };
