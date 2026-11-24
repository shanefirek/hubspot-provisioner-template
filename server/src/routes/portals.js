const express = require('express');
const { getValidToken } = require('../lib/tokens');
const { runProvisioning } = require('../provisioning');
const { CONTACT_PROPERTIES } = require('../provisioning/properties');
const { STANDARD_LISTS, getExistingListsByName } = require('../provisioning/lists');
const { WORKFLOW_DEFINITIONS } = require('../provisioning/workflows');
const { getLeadStatusOptionsStatus } = require('../provisioning/lead-status-options');

const router = express.Router();

const HS_API = 'https://api.hubapi.com';

// All properties are contacts for now; extend here if company/deal props are added
const ALL_PROPERTIES = CONTACT_PROPERTIES.map((p) => ({ ...p, objectType: 'contacts' }));

// GET /api/portals/:portalId/properties/status
router.get('/:portalId/properties/status', async (req, res) => {
  const portalId = Number(req.params.portalId);
  try {
    const accessToken = await getValidToken(portalId);

    const statuses = await Promise.all(
      ALL_PROPERTIES.map(async (prop) => {
        const r = await fetch(
          `${HS_API}/crm/v3/properties/${prop.objectType}/${prop.name}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        return { name: prop.name, label: prop.label, objectType: prop.objectType, exists: r.ok };
      })
    );

    res.json({ properties: statuses });
  } catch (err) {
    console.error(`[api] properties/status for portal ${portalId}:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/portals/:portalId/lists/all  — all contact lists with full filter definitions
router.get('/:portalId/lists/all', async (req, res) => {
  const portalId = Number(req.params.portalId);
  try {
    const accessToken = await getValidToken(portalId);
    const headers = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };

    // Step 1: search for all contact lists
    const all = [];
    let offset = 0;
    const count = 250;

    while (true) {
      const r = await fetch(`${HS_API}/crm/v3/lists/search`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ objectTypeId: '0-1', count, offset }),
      });
      if (!r.ok) throw new Error(`search ${r.status}: ${await r.text()}`);
      const data = await r.json();
      const lists = data.lists ?? [];
      // Response: { lists: [ { list: { listId, name, ... } }, ... ] }
      const items = data.lists ?? [];
      all.push(...items.map((i) => i.list ?? i));
      if (items.length < count) break;
      offset += count;
    }

    // Step 2: fetch full filter definition for each list
    const detailed = await Promise.all(
      all.map(async (l) => {
        const r = await fetch(
          `${HS_API}/crm/v3/lists/${l.listId}?includeFilters=true`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (!r.ok) return { ...l, _filterError: r.status };
        const d = await r.json();
        return d.list ?? d;
      })
    );

    res.json({ lists: detailed });
  } catch (err) {
    console.error(`[api] lists/all for portal ${portalId}:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/portals/:portalId/lists/status
router.get('/:portalId/lists/status', async (req, res) => {
  const portalId = Number(req.params.portalId);
  try {
    const accessToken = await getValidToken(portalId);
    const existingByName = await getExistingListsByName(accessToken);
    const statuses = STANDARD_LISTS.map((l) => ({
      key: l.key,
      name: l.name,
      description: l.description,
      exists: existingByName.has(l.name),
    }));
    res.json({ lists: statuses });
  } catch (err) {
    console.error(`[api] lists/status for portal ${portalId}:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/portals/:portalId/lead-status-options/status
router.get('/:portalId/lead-status-options/status', async (req, res) => {
  const portalId = Number(req.params.portalId);
  try {
    const accessToken = await getValidToken(portalId);
    const { required, all } = await getLeadStatusOptionsStatus(accessToken);
    res.json({ options: required, raw: all });
  } catch (err) {
    console.error(`[api] lead-status-options/status for portal ${portalId}:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/portals/:portalId/workflows/status
router.get('/:portalId/workflows/status', async (req, res) => {
  const portalId = Number(req.params.portalId);
  try {
    const accessToken = await getValidToken(portalId);
    const existingNames = new Set();
    let after;
    do {
      const url = new URL(`${HS_API}/automation/v4/flows`);
      url.searchParams.set('limit', '100');
      if (after) url.searchParams.set('after', after);
      const r = await fetch(url.toString(), { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!r.ok) throw new Error(`HubSpot ${r.status}: ${await r.text()}`);
      const data = await r.json();
      for (const f of data.flows ?? data.results ?? []) existingNames.add(f.name);
      after = data.paging?.next?.after;
    } while (after);

    const statuses = WORKFLOW_DEFINITIONS.map((wf) => ({
      name: wf.name,
      description: wf.description,
      exists: existingNames.has(wf.name),
    }));
    res.json({ workflows: statuses });
  } catch (err) {
    console.error(`[api] workflows/status for portal ${portalId}:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/portals/:portalId/workflows  — list with full definitions
router.get('/:portalId/workflows', async (req, res) => {
  const portalId = Number(req.params.portalId);
  try {
    const accessToken = await getValidToken(portalId);
    const headers = { Authorization: `Bearer ${accessToken}` };

    const listRes = await fetch(`${HS_API}/automation/v3/workflows`, { headers });
    if (!listRes.ok) throw new Error(`HubSpot error ${listRes.status}: ${await listRes.text()}`);
    const { workflows } = await listRes.json();

    // Fetch full definition — use v4 flows API for migrated workflows
    const full = await Promise.all(
      workflows.map(async (w) => {
        const flowId = w.migrationStatus?.flowId;
        if (flowId) {
          const r = await fetch(`${HS_API}/automation/v4/flows/${flowId}`, { headers });
          if (r.ok) return { ...w, _flowDefinition: await r.json() };
          // Fall through to v3 if v4 fails
        }
        const r = await fetch(`${HS_API}/automation/v3/workflows/${w.id}`, { headers });
        if (!r.ok) return { ...w, _fetchError: r.status };
        return r.json();
      })
    );

    res.json({ workflows: full });
  } catch (err) {
    console.error(`[api] workflows for portal ${portalId}:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/portals/:portalId/provision
router.post('/:portalId/provision', async (req, res) => {
  const portalId = Number(req.params.portalId);
  try {
    const accessToken = await getValidToken(portalId);
    const results = await runProvisioning(accessToken);
    res.json({ results });
  } catch (err) {
    console.error(`[api] provision for portal ${portalId}:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
