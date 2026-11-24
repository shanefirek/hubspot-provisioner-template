const { getLeadStatusLabelToValueMap, translateLeadStatusInPayload } = require('./lead-status-options');

const HS_API = 'https://api.hubapi.com';

// Standard contact lists provisioned on every new portal install.
// All DYNAMIC — HubSpot continuously evaluates membership based on filter criteria.
const STANDARD_LISTS = [
  {
    key: 'domainDnc',
    name: 'Do Not Contact (Domain)',
    description: 'Contacts excluded because their associated company has open deals or is already a customer.',
    objectTypeId: '0-1',
    processingType: 'DYNAMIC',
    filterBranch: {
      filterBranches: [
        {
          filterBranches: [
            {
              filterBranches: [],
              filters: [{ property: 'hs_num_open_deals', operation: { operator: 'IS_GREATER_THAN', includeObjectsWithNoValueSet: false, value: 0, operationType: 'NUMBER' }, filterType: 'PROPERTY' }],
              objectTypeId: '0-2', operator: 'IN_LIST', associationTypeId: 279, associationCategory: 'HUBSPOT_DEFINED',
              filterBranchOperator: 'AND', filterBranchType: 'ASSOCIATION',
            },
          ],
          filters: [], filterBranchOperator: 'AND', filterBranchType: 'AND',
        },
        {
          filterBranches: [
            {
              filterBranches: [],
              filters: [{ property: 'hs_is_closed_won', operation: { operator: 'IS_EQUAL_TO', includeObjectsWithNoValueSet: false, value: true, operationType: 'BOOL' }, filterType: 'PROPERTY' }],
              objectTypeId: '0-3', operator: 'IN_LIST', associationTypeId: 4, associationCategory: 'HUBSPOT_DEFINED',
              filterBranchOperator: 'AND', filterBranchType: 'ASSOCIATION',
            },
          ],
          filters: [], filterBranchOperator: 'AND', filterBranchType: 'AND',
        },
      ],
      filters: [], filterBranchOperator: 'OR', filterBranchType: 'OR',
    },
  },

  {
    key: 'newLeadExclusion',
    name: 'Do Not Contact (Individual)',
    description: 'Contacts excluded from new lead enrollment — existing customers, DNC flagged, or associated with active deals.',
    objectTypeId: '0-1',
    processingType: 'DYNAMIC',
    filterBranch: {
      filterBranches: [
        {
          filterBranches: [
            {
              filterBranches: [],
              filters: [{ property: 'hs_num_open_deals', operation: { operator: 'IS_GREATER_THAN', includeObjectsWithNoValueSet: false, value: 0, operationType: 'NUMBER' }, filterType: 'PROPERTY' }],
              objectTypeId: '0-2', operator: 'IN_LIST', associationTypeId: 279, associationCategory: 'HUBSPOT_DEFINED',
              filterBranchOperator: 'AND', filterBranchType: 'ASSOCIATION',
            },
          ],
          filters: [], filterBranchOperator: 'AND', filterBranchType: 'AND',
        },
        {
          filterBranches: [
            {
              filterBranches: [],
              filters: [{ property: 'hs_is_closed_won', operation: { operator: 'IS_EQUAL_TO', includeObjectsWithNoValueSet: false, value: true, operationType: 'BOOL' }, filterType: 'PROPERTY' }],
              objectTypeId: '0-3', operator: 'IN_LIST', associationTypeId: 4, associationCategory: 'HUBSPOT_DEFINED',
              filterBranchOperator: 'AND', filterBranchType: 'ASSOCIATION',
            },
          ],
          filters: [], filterBranchOperator: 'AND', filterBranchType: 'AND',
        },
        {
          filterBranches: [
            {
              filterBranches: [],
              filters: [{ property: 'lifecyclestage', operation: { operator: 'IS_ANY_OF', includeObjectsWithNoValueSet: false, values: ['evangelist', 'opportunity', 'customer'], operationType: 'ENUMERATION' }, filterType: 'PROPERTY' }],
              objectTypeId: '0-2', operator: 'IN_LIST', associationTypeId: 279, associationCategory: 'HUBSPOT_DEFINED',
              filterBranchOperator: 'AND', filterBranchType: 'ASSOCIATION',
            },
          ],
          filters: [], filterBranchOperator: 'AND', filterBranchType: 'AND',
        },
        {
          filterBranches: [],
          filters: [{ property: 'dnc_status', operation: { operator: 'IS_ANY_OF', includeObjectsWithNoValueSet: false, values: ['true'], operationType: 'ENUMERATION' }, filterType: 'PROPERTY' }],
          filterBranchOperator: 'AND', filterBranchType: 'AND',
        },
      ],
      filters: [], filterBranchOperator: 'OR', filterBranchType: 'OR',
    },
  },

  {
    key: 'sdrNurture',
    name: 'SDR Lead Status -> Nurture',
    description: 'Contacts in progress who have not been emailed in 21+ days — triggers the nurture workflow.',
    objectTypeId: '0-1',
    processingType: 'DYNAMIC',
    filterBranch: {
      filterBranches: [
        {
          filterBranches: [],
          filters: [
            { property: 'hs_lead_status', operation: { operator: 'IS_ANY_OF', includeObjectsWithNoValueSet: false, values: ['IN_PROGRESS'], operationType: 'ENUMERATION' }, filterType: 'PROPERTY' },
            {
              property: 'os_last_sent_time',
              operation: {
                operator: 'IS_BEFORE', includeObjectsWithNoValueSet: false,
                timePoint: { timezoneSource: 'CUSTOM', zoneId: 'UTC', indexReference: { referenceType: 'TODAY' }, offset: { days: -21 }, timeType: 'INDEXED' },
                endpointBehavior: 'EXCLUSIVE', propertyParser: 'VALUE', operationType: 'TIME_POINT', type: 'TIME_POINT',
              },
              filterType: 'PROPERTY',
            },
          ],
          filterBranchType: 'AND', filterBranchOperator: 'AND',
        },
      ],
      filters: [], filterBranchType: 'OR', filterBranchOperator: 'OR',
    },
  },
];

async function createLists(_client, accessToken) {
  const existingByName = await getExistingListsByName(accessToken);
  const labelToValueMap = await getLeadStatusLabelToValueMap(accessToken);
  const listIds = {};

  for (const list of STANDARD_LISTS) {
    if (existingByName.has(list.name)) {
      const id = existingByName.get(list.name);
      console.log(`[lists] already exists: ${list.name} (id: ${id})`);
      listIds[list.key] = id;
      continue;
    }

    const filterBranch = translateLeadStatusInPayload(
      JSON.parse(JSON.stringify(list.filterBranch)),
      labelToValueMap
    );

    const res = await fetch(`${HS_API}/crm/v3/lists`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: list.name,
        objectTypeId: list.objectTypeId,
        processingType: list.processingType,
        filterBranch,
      }),
    });

    if (!res.ok) throw new Error(`Failed to create list "${list.name}": ${await res.text()}`);

    const data = await res.json();
    // Response is nested: { list: { listId, name, ... } }
    const created = data.list ?? data;
    listIds[list.key] = String(created.listId);
    console.log(`[lists] created: ${list.name} (id: ${created.listId})`);
  }

  return { listIds };
}

async function getExistingListsByName(accessToken) {
  const byName = new Map();
  let offset = 0;
  const count = 250;

  while (true) {
    const res = await fetch(`${HS_API}/crm/v3/lists/search`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ objectTypeId: '0-1', count, offset }),
    });
    if (!res.ok) throw new Error(`Failed to fetch lists: ${await res.text()}`);

    const data = await res.json();
    // Each item in data.lists is { list: { listId, name, ... } }
    const lists = data.lists ?? [];
    for (const item of lists) {
      const l = item.list ?? item;
      byName.set(l.name, l.listId);
    }
    if (lists.length < count) break;
    offset += count;
  }

  return byName;
}

module.exports = { createLists, STANDARD_LISTS, getExistingListsByName };
