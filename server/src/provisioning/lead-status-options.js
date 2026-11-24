const HS_API = 'https://api.hubapi.com';

// Options the provisioned workflows require on the standard hs_lead_status
// property. Some are HubSpot defaults that newer portals ship without
// (CONNECTED); others are custom values the workflows set or filter on.
// Workflow creation validates action target values, so any missing option
// here causes flow creation to fail with HTTP 400.
const REQUIRED_OPTIONS = [
  { value: 'NEW', label: 'New' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'CONNECTED', label: 'Connected' },
  { value: 'Interested', label: 'Interested' },
  { value: 'Not Interested', label: 'Not Interested' },
  { value: 'Meeting Booked', label: 'Meeting Booked' },
];

// Maps the canonical internal values our workflow definitions hardcode (which
// come from the source portal) to the display label. Different portals
// store defaults with different internal-value casings — older portals use
// SCREAMING_SNAKE (NEW, IN_PROGRESS) while newer ones use PascalCase or label
// form (New, In Progress). Looking up by label gives us the portal-specific
// internal value to use in workflow action targets and filters.
const CANONICAL_VALUE_TO_LABEL = {
  NEW: 'New',
  IN_PROGRESS: 'In Progress',
  CONNECTED: 'Connected',
  Interested: 'Interested',
  'Not Interested': 'Not Interested',
  'Meeting Booked': 'Meeting Booked',
};

function normalizeLabel(s) {
  return (s ?? '').trim().toLowerCase();
}

async function readLeadStatusProperty(accessToken) {
  const res = await fetch(`${HS_API}/crm/v3/properties/contacts/hs_lead_status`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Failed to read hs_lead_status: ${await res.text()}`);
  return res.json();
}

async function diffLeadStatusOptions(accessToken) {
  const prop = await readLeadStatusProperty(accessToken);
  const existing = Array.isArray(prop.options) ? prop.options : [];
  const existingValues = new Set(existing.map((o) => o.value));
  const existingLabels = new Set(existing.map((o) => normalizeLabel(o.label)));

  const missing = REQUIRED_OPTIONS.filter(
    (o) => !existingValues.has(o.value) && !existingLabels.has(normalizeLabel(o.label))
  );

  return { existing, missing };
}

async function ensureLeadStatusOptions(_client, accessToken) {
  const headers = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };
  const { existing, missing } = await diffLeadStatusOptions(accessToken);

  if (missing.length === 0) {
    console.log('[lead-status-options] all required options already present');
    return;
  }

  const maxOrder = existing.reduce((m, o) => Math.max(m, o.displayOrder ?? -1), -1);
  const additions = missing.map((o, i) => ({
    label: o.label,
    value: o.value,
    displayOrder: maxOrder + 1 + i,
    hidden: false,
  }));

  const patchRes = await fetch(`${HS_API}/crm/v3/properties/contacts/hs_lead_status`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ options: [...existing, ...additions] }),
  });
  if (!patchRes.ok) throw new Error(`Failed to update hs_lead_status options: ${await patchRes.text()}`);

  console.log(`[lead-status-options] added: ${missing.map((o) => o.value).join(', ')}`);
}

async function getLeadStatusOptionsStatus(accessToken) {
  const { existing, missing } = await diffLeadStatusOptions(accessToken);
  const missingValues = new Set(missing.map((o) => o.value));
  const required = REQUIRED_OPTIONS.map((o) => ({
    value: o.value,
    label: o.label,
    exists: !missingValues.has(o.value),
  }));
  const all = existing.map((o) => ({ value: o.value, label: o.label, hidden: o.hidden }));
  return { required, all };
}

// Returns a Map<labelLowercased, actualInternalValue> for the portal's current
// hs_lead_status options. Used by workflows.js to rewrite hardcoded canonical
// values (e.g. 'NEW') into whatever the portal stores ('New', 'NEW', etc.).
async function getLeadStatusLabelToValueMap(accessToken) {
  const prop = await readLeadStatusProperty(accessToken);
  const map = new Map();
  for (const opt of prop.options ?? []) {
    if (opt.label) map.set(normalizeLabel(opt.label), opt.value);
  }
  return map;
}

function translateLeadStatusValue(canonical, labelToValueMap) {
  if (typeof canonical !== 'string') return canonical;
  const label = CANONICAL_VALUE_TO_LABEL[canonical] ?? canonical;
  const actual = labelToValueMap.get(normalizeLabel(label));
  return actual ?? canonical;
}

// Walks a workflow or list body and replaces every hs_lead_status value
// (workflow action targets and property filters in both workflows and list
// filter branches) with the portal's actual internal value, looked up by
// label. Mutates in place — caller is responsible for cloning first.
function translateLeadStatusInPayload(payload, labelToValueMap) {
  const walk = (obj) => {
    if (Array.isArray(obj)) {
      obj.forEach(walk);
      return;
    }
    if (!obj || typeof obj !== 'object') return;

    if (obj.fields?.property_name === 'hs_lead_status' && obj.fields.value?.staticValue) {
      obj.fields.value.staticValue = translateLeadStatusValue(obj.fields.value.staticValue, labelToValueMap);
    }
    if (obj.property === 'hs_lead_status' && obj.operation) {
      if (Array.isArray(obj.operation.values)) {
        obj.operation.values = obj.operation.values.map((v) => translateLeadStatusValue(v, labelToValueMap));
      }
      if (typeof obj.operation.value === 'string') {
        obj.operation.value = translateLeadStatusValue(obj.operation.value, labelToValueMap);
      }
    }

    for (const k of Object.keys(obj)) walk(obj[k]);
  };

  walk(payload);
  return payload;
}

module.exports = {
  ensureLeadStatusOptions,
  getLeadStatusOptionsStatus,
  getLeadStatusLabelToValueMap,
  translateLeadStatusInPayload,
  REQUIRED_OPTIONS,
};
