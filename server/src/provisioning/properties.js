const GROUP_NAME = 'provisioner_';
const GROUP_LABEL = 'Provisioner';
const HS_API = 'https://api.hubapi.com';

const CONTACT_PROPERTIES = [
  {
    name: 'campaign_name',
    label: 'Campaign Name',
    type: 'string',
    fieldType: 'text',
    groupName: GROUP_NAME,
    description: 'Campaign Name',
  },
  {
    name: 'campaign_type',
    label: 'Campaign Type',
    type: 'enumeration',
    fieldType: 'select',
    groupName: GROUP_NAME,
    description: 'Type of campaign - Targeted List, Signal, Inbound',
    options: [
      { label: 'Inbound', value: 'Inbound', displayOrder: 0, hidden: false },
      { label: 'Targeted List', value: 'Targeted List', displayOrder: 1, hidden: false },
      { label: 'Signal', value: 'Signal', displayOrder: 2, hidden: false },
    ],
  },
  {
    name: 'dnc_status',
    label: 'DNC Status',
    type: 'enumeration',
    fieldType: 'booleancheckbox',
    groupName: GROUP_NAME,
    description: 'Do Not Contact',
    options: [
      { label: 'Yes', value: 'true', displayOrder: 0, hidden: false },
      { label: 'No', value: 'false', displayOrder: 1, hidden: false },
    ],
  },
  {
    name: 'hold_rate_score',
    label: 'Hold Rate Score',
    type: 'number',
    fieldType: 'number',
    groupName: GROUP_NAME,
  },
  {
    name: 'icp_fit',
    label: 'ICP Fit',
    type: 'number',
    fieldType: 'number',
    groupName: GROUP_NAME,
  },
  {
    name: 'lead_origin',
    label: 'Lead Origin',
    type: 'string',
    fieldType: 'text',
    groupName: GROUP_NAME,
    description: 'Source (Website, LinkedIn, etc.)',
  },
  {
    name: 'lead_origin_details',
    label: 'Lead Origin Details',
    type: 'string',
    fieldType: 'text',
    groupName: GROUP_NAME,
    description: 'Fit-related context',
  },
  {
    name: 'os_last_sent_time',
    label: 'OS Last Sent Time',
    type: 'datetime',
    fieldType: 'date',
    groupName: GROUP_NAME,
    description: 'Timestamp of the last outbound message sent to this contact.',
  },
  {
    name: 'os_last_lead_category_name',
    label: 'OS Last Lead Category Name',
    type: 'string',
    fieldType: 'text',
    groupName: GROUP_NAME,
    description: 'Most recent lead category classification from the outbound system.',
  },
  {
    name: 'meeting_attendance',
    label: 'Meeting Attendance',
    type: 'enumeration',
    fieldType: 'select',
    groupName: GROUP_NAME,
    options: [
      { label: 'Yes', value: 'Yes', displayOrder: 0, hidden: false },
      { label: 'No', value: 'No', displayOrder: 1, hidden: false },
      { label: 'Rescheduled', value: 'Rescheduled', displayOrder: 2, hidden: false },
    ],
  },
  {
    name: 'meeting_booked_time',
    label: 'Meeting Booked Time',
    type: 'date',
    fieldType: 'date',
    groupName: GROUP_NAME,
    description: 'Date stamp when meeting was booked',
  },
  {
    name: 'meeting_feedback',
    label: 'Meeting Feedback',
    type: 'string',
    fieldType: 'text',
    groupName: GROUP_NAME,
  },
  {
    name: 'meeting_scheduled_date',
    label: 'Meeting Scheduled Date',
    type: 'date',
    fieldType: 'date',
    groupName: GROUP_NAME,
  },
  {
    name: 'person_icp_description',
    label: 'Person ICP Description',
    type: 'string',
    fieldType: 'text',
    groupName: GROUP_NAME,
    description: 'Scoring rationale',
  },
  {
    name: 'person_icp_score',
    label: 'Person ICP Score',
    type: 'number',
    fieldType: 'number',
    groupName: GROUP_NAME,
  },
  {
    name: 'call_list',
    label: 'Call List',
    type: 'enumeration',
    fieldType: 'booleancheckbox',
    groupName: GROUP_NAME,
    description: 'Contact added to call campaign',
    options: [
      { label: 'Yes', value: 'true', displayOrder: 0, hidden: false },
      { label: 'No', value: 'false', displayOrder: 1, hidden: false },
    ],
  },
  {
    name: 'sdr_status',
    label: 'SDR Status',
    type: 'enumeration',
    fieldType: 'booleancheckbox',
    groupName: GROUP_NAME,
    description: 'Meeting booked by SDR',
    options: [
      { label: 'Yes', value: 'true', displayOrder: 0, hidden: false },
      { label: 'No', value: 'false', displayOrder: 1, hidden: false },
    ],
  },
];

async function createProperties(client, accessToken, _ctx) {
  await upsertPropertyGroup(accessToken);

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const prop of CONTACT_PROPERTIES) {
    try {
      await client.crm.properties.coreApi.create('contacts', prop);
      console.log(`[properties] created: ${prop.name}`);
      created++;
    } catch (err) {
      const status = err.statusCode ?? err.code ?? err.response?.status;
      if (status === 409) {
        console.log(`[properties] already exists, skipping: ${prop.name}`);
        skipped++;
      } else {
        // Log and continue — don't let one bad property block the rest
        console.error(`[properties] failed: ${prop.name} — ${err.message}`);
        failed++;
      }
    }
  }

  console.log(`[properties] done — created: ${created}, skipped: ${skipped}, failed: ${failed}`);
  if (failed > 0) throw new Error(`${failed} propert${failed === 1 ? 'y' : 'ies'} failed to create`);
}

// Try POST first; if that fails for any reason, verify via GET before throwing.
// HubSpot may not always return 409 for an existing group.
async function upsertPropertyGroup(accessToken) {
  const headers = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };

  const createRes = await fetch(`${HS_API}/crm/v3/properties/contacts/groups`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ name: GROUP_NAME, label: GROUP_LABEL }),
  });

  if (createRes.ok) {
    console.log(`[properties] created group: ${GROUP_NAME}`);
    return;
  }

  // Regardless of the error code, check if the group already exists
  const getRes = await fetch(`${HS_API}/crm/v3/properties/contacts/groups/${GROUP_NAME}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (getRes.ok) {
    console.log('[properties] group already exists, skipping');
    return;
  }

  const errBody = await createRes.text();
  throw new Error(`Failed to create property group "${GROUP_NAME}": ${errBody}`);
}

module.exports = { createProperties, CONTACT_PROPERTIES };
