const { getLeadStatusLabelToValueMap, translateLeadStatusInPayload } = require('./lead-status-options');

const HS_API = 'https://api.hubapi.com';

// Standard workflows provisioned on every new portal install.
//
// Two workflows are created DISABLED because they rely on portal-specific
// contact lists that don't transfer across portals:
//   - Newly Identified Lead  (NOT_IN_LIST filter stripped, created disabled)
//   - SDR Lead Status -> Nurture  (IN_LIST enrollment stripped, created disabled)
// After install, configure the list references manually and re-enable them.

const WORKFLOW_DEFINITIONS = [
  {
    name: 'Newly Identified Lead',
    description: 'Sets the lead status to "New" for contacts with a known lead origin and unknown lead status.',
    flowType: 'WORKFLOW',
    type: 'CONTACT_FLOW',
    objectTypeId: '0-1',
    isEnabled: false, // re-enable after adding the NOT_IN_LIST exclusion list
    startActionId: '1',
    nextAvailableActionId: '2',
    actions: [
      {
        actionId: '1',
        actionTypeVersion: 0,
        actionTypeId: '0-5',
        fields: {
          property_name: 'hs_lead_status',
          value: { staticValue: 'NEW', type: 'STATIC_VALUE' },
        },
        type: 'SINGLE_CONNECTION',
      },
    ],
    enrollmentCriteria: {
      shouldReEnroll: false,
      listFilterBranch: {
        filterBranches: [
          {
            filterBranches: [],
            filters: [
              {
                property: 'lead_origin',
                operation: { operator: 'IS_KNOWN', includeObjectsWithNoValueSet: false, operationType: 'ALL_PROPERTY' },
                filterType: 'PROPERTY',
              },
              {
                property: 'hs_lead_status',
                operation: { operator: 'IS_UNKNOWN', includeObjectsWithNoValueSet: false, operationType: 'ALL_PROPERTY' },
                filterType: 'PROPERTY',
              },
              // NOT_IN_LIST filter removed — add a portal-specific exclusion list and re-enable
            ],
            filterBranchType: 'AND',
            filterBranchOperator: 'AND',
          },
        ],
        filters: [],
        filterBranchType: 'OR',
        filterBranchOperator: 'OR',
      },
      unEnrollObjectsNotMeetingCriteria: false,
      reEnrollmentTriggersFilterBranches: [],
      type: 'LIST_BASED',
    },
    timeWindows: [],
    blockedDates: [],
    customProperties: {},
    suppressionListIds: [],
    canEnrollFromSalesforce: false,
  },

  {
    name: 'Leads → In Progress (OBS)',
    description: 'Updates Lead Status to "In Progress" when the "Last email sent time" property changes for leads currently marked as New or Nurture.',
    flowType: 'WORKFLOW',
    type: 'CONTACT_FLOW',
    objectTypeId: '0-1',
    isEnabled: true,
    startActionId: '1',
    nextAvailableActionId: '2',
    actions: [
      {
        actionId: '1',
        actionTypeVersion: 0,
        actionTypeId: '0-5',
        fields: {
          property_name: 'hs_lead_status',
          value: { staticValue: 'IN_PROGRESS', type: 'STATIC_VALUE' },
        },
        type: 'SINGLE_CONNECTION',
      },
    ],
    enrollmentCriteria: {
      shouldReEnroll: true,
      eventFilterBranches: [
        {
          filterBranches: [],
          filters: [
            {
              property: 'hs_name',
              operation: { operator: 'IS_EQUAL_TO', includeObjectsWithNoValueSet: false, value: 'os_last_sent_time', operationType: 'STRING' },
              filterType: 'PROPERTY',
            },
            {
              property: 'hs_value',
              operation: { operator: 'IS_KNOWN', includeObjectsWithNoValueSet: false, operationType: 'ALL_PROPERTY' },
              filterType: 'PROPERTY',
            },
          ],
          eventTypeId: '4-655002',
          operator: 'HAS_COMPLETED',
          filterBranchType: 'UNIFIED_EVENTS',
          filterBranchOperator: 'AND',
        },
      ],
      refinementCriteria: {
        filterBranches: [
          {
            filterBranches: [],
            filters: [
              {
                property: 'hs_lead_status',
                operation: { operator: 'IS_ANY_OF', includeObjectsWithNoValueSet: false, values: ['NEW', 'IN_PROGRESS'], operationType: 'ENUMERATION' },
                filterType: 'PROPERTY',
              },
            ],
            filterBranchType: 'AND',
            filterBranchOperator: 'AND',
          },
        ],
        filters: [],
        filterBranchType: 'OR',
        filterBranchOperator: 'OR',
      },
      listMembershipFilterBranches: [],
      type: 'EVENT_BASED',
    },
    timeWindows: [],
    blockedDates: [],
    customProperties: {},
    suppressionListIds: [],
    canEnrollFromSalesforce: false,
  },

  {
    name: 'Lead Status Update (OBS)',
    description: 'Updates lead status and related properties based on changes to the lead category, only for leads with status In Progress, New, or Nurture.',
    flowType: 'WORKFLOW',
    type: 'CONTACT_FLOW',
    objectTypeId: '0-1',
    isEnabled: true,
    startActionId: '1',
    nextAvailableActionId: '11',
    actions: [
      {
        actionId: '1',
        inputValue: { propertyName: 'os_last_lead_category_name', type: 'OBJECT_PROPERTY' },
        staticBranches: [
          { branchValue: 'Interested', connection: { edgeType: 'STANDARD', nextActionId: '2' } },
          { branchValue: 'Lead Interested', connection: { edgeType: 'STANDARD', nextActionId: '3' } },
          { branchValue: 'Not Interested', connection: { edgeType: 'STANDARD', nextActionId: '4' } },
          { branchValue: 'Do Not Contact', connection: { edgeType: 'STANDARD', nextActionId: '5' } },
          { branchValue: 'Wrong Person', connection: { edgeType: 'STANDARD', nextActionId: '6' } },
          { branchValue: 'Referral', connection: { edgeType: 'STANDARD', nextActionId: '7' } },
        ],
        type: 'STATIC_BRANCH',
      },
      {
        actionId: '2',
        actionTypeVersion: 0,
        actionTypeId: '0-5',
        connection: { edgeType: 'STANDARD', nextActionId: '8' },
        fields: { property_name: 'hs_lead_status', value: { staticValue: 'Interested', type: 'STATIC_VALUE' } },
        type: 'SINGLE_CONNECTION',
      },
      {
        actionId: '3',
        actionTypeVersion: 0,
        actionTypeId: '0-5',
        connection: { edgeType: 'STANDARD', nextActionId: '9' },
        fields: { property_name: 'hs_lead_status', value: { staticValue: 'Interested', type: 'STATIC_VALUE' } },
        type: 'SINGLE_CONNECTION',
      },
      {
        actionId: '4',
        actionTypeVersion: 0,
        actionTypeId: '0-5',
        fields: { property_name: 'hs_lead_status', value: { staticValue: 'Not Interested', type: 'STATIC_VALUE' } },
        type: 'SINGLE_CONNECTION',
      },
      {
        actionId: '5',
        actionTypeVersion: 0,
        actionTypeId: '0-5',
        connection: { edgeType: 'STANDARD', nextActionId: '10' },
        fields: { property_name: 'hs_lead_status', value: { staticValue: 'Not Interested', type: 'STATIC_VALUE' } },
        type: 'SINGLE_CONNECTION',
      },
      {
        actionId: '6',
        actionTypeVersion: 0,
        actionTypeId: '0-5',
        fields: { property_name: 'hs_lead_status', value: { staticValue: 'Not Interested', type: 'STATIC_VALUE' } },
        type: 'SINGLE_CONNECTION',
      },
      {
        actionId: '7',
        actionTypeVersion: 0,
        actionTypeId: '0-5',
        fields: { property_name: 'hs_lead_status', value: { staticValue: 'CONNECTED', type: 'STATIC_VALUE' } },
        type: 'SINGLE_CONNECTION',
      },
      {
        actionId: '8',
        actionTypeVersion: 0,
        actionTypeId: '0-5',
        fields: { property_name: 'lifecyclestage', value: { staticValue: 'marketingqualifiedlead', type: 'STATIC_VALUE' } },
        type: 'SINGLE_CONNECTION',
      },
      {
        actionId: '9',
        actionTypeVersion: 0,
        actionTypeId: '0-5',
        fields: { property_name: 'lifecyclestage', value: { staticValue: 'marketingqualifiedlead', type: 'STATIC_VALUE' } },
        type: 'SINGLE_CONNECTION',
      },
      {
        actionId: '10',
        actionTypeVersion: 0,
        actionTypeId: '0-5',
        fields: { property_name: 'dnc_status', value: { staticValue: 'true', type: 'STATIC_VALUE' } },
        type: 'SINGLE_CONNECTION',
      },
    ],
    enrollmentCriteria: {
      shouldReEnroll: true,
      eventFilterBranches: [
        {
          filterBranches: [],
          filters: [
            {
              property: 'hs_name',
              operation: { operator: 'IS_EQUAL_TO', includeObjectsWithNoValueSet: false, value: 'os_last_lead_category_name', operationType: 'STRING' },
              filterType: 'PROPERTY',
            },
            {
              property: 'hs_value',
              operation: { operator: 'IS_KNOWN', includeObjectsWithNoValueSet: false, operationType: 'ALL_PROPERTY' },
              filterType: 'PROPERTY',
            },
          ],
          eventTypeId: '4-655002',
          operator: 'HAS_COMPLETED',
          filterBranchType: 'UNIFIED_EVENTS',
          filterBranchOperator: 'AND',
        },
      ],
      refinementCriteria: {
        filterBranches: [
          {
            filterBranches: [],
            filters: [
              {
                property: 'hs_lead_status',
                operation: { operator: 'IS_ANY_OF', includeObjectsWithNoValueSet: false, values: ['IN_PROGRESS', 'NEW'], operationType: 'ENUMERATION' },
                filterType: 'PROPERTY',
              },
            ],
            filterBranchType: 'AND',
            filterBranchOperator: 'AND',
          },
        ],
        filters: [],
        filterBranchType: 'OR',
        filterBranchOperator: 'OR',
      },
      listMembershipFilterBranches: [],
      type: 'EVENT_BASED',
    },
    timeWindows: [],
    blockedDates: [],
    customProperties: {},
    suppressionListIds: [],
    canEnrollFromSalesforce: false,
  },

  {
    name: 'SDR Lead Status -> Nurture',
    description: 'Updates the lead status to "Nurture" for contacts who are members of a specific list.',
    flowType: 'WORKFLOW',
    type: 'CONTACT_FLOW',
    objectTypeId: '0-1',
    isEnabled: false, // re-enable after configuring the IN_LIST enrollment trigger with a portal-specific list
    startActionId: '1',
    nextAvailableActionId: '2',
    actions: [
      {
        actionId: '1',
        actionTypeVersion: 0,
        actionTypeId: '0-5',
        fields: {
          property_name: 'hs_lead_status',
          value: { staticValue: 'IN_PROGRESS', type: 'STATIC_VALUE' },
        },
        type: 'SINGLE_CONNECTION',
      },
    ],
    enrollmentCriteria: {
      shouldReEnroll: true,
      eventFilterBranches: [],
      listMembershipFilterBranches: [], // add portal-specific IN_LIST trigger and re-enable
      type: 'EVENT_BASED',
    },
    timeWindows: [],
    blockedDates: [],
    customProperties: {},
    suppressionListIds: [],
    canEnrollFromSalesforce: false,
  },

  {
    name: 'Meeting Booked',
    description: 'Sets the meeting booked time to the current time and updates the lifecycle stage to Sales Qualified Lead when a contact with SDR marked Yes has a lead status of Meeting Booked.',
    flowType: 'WORKFLOW',
    type: 'CONTACT_FLOW',
    objectTypeId: '0-1',
    isEnabled: true,
    startActionId: '1',
    nextAvailableActionId: '3',
    actions: [
      {
        actionId: '1',
        actionTypeVersion: 0,
        actionTypeId: '0-5',
        connection: { edgeType: 'STANDARD', nextActionId: '2' },
        fields: {
          property_name: 'meeting_booked_time',
          value: { timestampType: 'EXECUTION_TIME', type: 'TIMESTAMP' },
        },
        type: 'SINGLE_CONNECTION',
      },
      {
        actionId: '2',
        actionTypeVersion: 0,
        actionTypeId: '0-5',
        fields: {
          property_name: 'lifecyclestage',
          value: { staticValue: 'salesqualifiedlead', type: 'STATIC_VALUE' },
        },
        type: 'SINGLE_CONNECTION',
      },
    ],
    enrollmentCriteria: {
      shouldReEnroll: false,
      listFilterBranch: {
        filterBranches: [
          {
            filterBranches: [],
            filters: [
              {
                property: 'hs_lead_status',
                operation: { operator: 'IS_ANY_OF', includeObjectsWithNoValueSet: false, values: ['Meeting Booked'], operationType: 'ENUMERATION' },
                filterType: 'PROPERTY',
              },
              {
                property: 'sdr_status',
                operation: { operator: 'IS_EQUAL_TO', includeObjectsWithNoValueSet: false, value: true, operationType: 'BOOL' },
                filterType: 'PROPERTY',
              },
            ],
            filterBranchType: 'AND',
            filterBranchOperator: 'AND',
          },
        ],
        filters: [],
        filterBranchType: 'OR',
        filterBranchOperator: 'OR',
      },
      unEnrollObjectsNotMeetingCriteria: false,
      reEnrollmentTriggersFilterBranches: [],
      type: 'LIST_BASED',
    },
    timeWindows: [],
    blockedDates: [],
    customProperties: {},
    suppressionListIds: [],
    canEnrollFromSalesforce: false,
  },

  {
    name: 'Hold Rate Score',
    description: 'Updates the Hold Rate Score based on Meeting Attendance status: sets to 100 if attended, 0 if not, and clears the score if rescheduled.',
    flowType: 'WORKFLOW',
    type: 'CONTACT_FLOW',
    objectTypeId: '0-1',
    isEnabled: true,
    startActionId: '1',
    nextAvailableActionId: '5',
    actions: [
      {
        actionId: '1',
        inputValue: { propertyName: 'meeting_attendance', type: 'OBJECT_PROPERTY' },
        staticBranches: [
          { branchValue: 'Yes', connection: { edgeType: 'STANDARD', nextActionId: '2' } },
          { branchValue: 'No', connection: { edgeType: 'STANDARD', nextActionId: '3' } },
          { branchValue: 'Rescheduled', connection: { edgeType: 'STANDARD', nextActionId: '4' } },
        ],
        type: 'STATIC_BRANCH',
      },
      {
        actionId: '2',
        actionTypeVersion: 0,
        actionTypeId: '0-5',
        fields: { property_name: 'hold_rate_score', value: { staticValue: '100', type: 'STATIC_VALUE' } },
        type: 'SINGLE_CONNECTION',
      },
      {
        actionId: '3',
        actionTypeVersion: 0,
        actionTypeId: '0-5',
        fields: { property_name: 'hold_rate_score', value: { staticValue: '0', type: 'STATIC_VALUE' } },
        type: 'SINGLE_CONNECTION',
      },
      {
        actionId: '4',
        actionTypeVersion: 0,
        actionTypeId: '0-5',
        fields: { property_name: 'hold_rate_score', value: { staticValue: '', type: 'STATIC_VALUE' } },
        type: 'SINGLE_CONNECTION',
      },
    ],
    enrollmentCriteria: {
      shouldReEnroll: true,
      eventFilterBranches: [
        {
          filterBranches: [],
          filters: [
            {
              property: 'hs_name',
              operation: { operator: 'IS_EQUAL_TO', includeObjectsWithNoValueSet: false, value: 'meeting_attendance', operationType: 'STRING' },
              filterType: 'PROPERTY',
            },
            {
              property: 'hs_value',
              operation: { operator: 'IS_KNOWN', includeObjectsWithNoValueSet: false, operationType: 'ALL_PROPERTY' },
              filterType: 'PROPERTY',
            },
          ],
          eventTypeId: '4-655002',
          operator: 'HAS_COMPLETED',
          filterBranchType: 'UNIFIED_EVENTS',
          filterBranchOperator: 'AND',
        },
      ],
      listMembershipFilterBranches: [],
      type: 'EVENT_BASED',
    },
    timeWindows: [],
    blockedDates: [],
    customProperties: {},
    suppressionListIds: [],
    canEnrollFromSalesforce: false,
  },
];

// Inject portal-specific list IDs into the two workflows that need them.
function applyListIds(definitions, listIds = {}) {
  return definitions.map((wf) => {
    if (wf.name === 'Newly Identified Lead' && listIds.newLeadExclusion) {
      const branch = wf.enrollmentCriteria.listFilterBranch.filterBranches[0];
      return {
        ...wf,
        isEnabled: true,
        enrollmentCriteria: {
          ...wf.enrollmentCriteria,
          listFilterBranch: {
            ...wf.enrollmentCriteria.listFilterBranch,
            filterBranches: [{
              ...branch,
              filters: [
                ...branch.filters,
                { listId: String(listIds.newLeadExclusion), operator: 'NOT_IN_LIST', filterType: 'IN_LIST' },
              ],
            }],
          },
        },
      };
    }
    if (wf.name === 'SDR Lead Status -> Nurture' && listIds.sdrNurture) {
      return {
        ...wf,
        isEnabled: true,
        enrollmentCriteria: {
          ...wf.enrollmentCriteria,
          listMembershipFilterBranches: [{
            filterBranches: [],
            filters: [{ listId: String(listIds.sdrNurture), operator: 'IN_LIST', filterType: 'IN_LIST' }],
            filterBranchType: 'AND',
            filterBranchOperator: 'AND',
          }],
        },
      };
    }
    return wf;
  });
}

async function getExistingWorkflowNames(accessToken) {
  const names = new Set();
  let after;

  do {
    const url = new URL(`${HS_API}/automation/v4/flows`);
    url.searchParams.set('limit', '100');
    if (after) url.searchParams.set('after', after);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error(`Failed to list workflows: ${await res.text()}`);

    const data = await res.json();
    const flows = data.flows ?? data.results ?? [];
    for (const f of flows) names.add(f.name);

    after = data.paging?.next?.after;
  } while (after);

  return names;
}

async function createWorkflows(_client, accessToken, ctx = {}) {
  const labelToValueMap = await getLeadStatusLabelToValueMap(accessToken);
  const definitions = applyListIds(WORKFLOW_DEFINITIONS, ctx.listIds).map((wf) =>
    translateLeadStatusInPayload(JSON.parse(JSON.stringify(wf)), labelToValueMap)
  );
  const existingNames = await getExistingWorkflowNames(accessToken);
  let created = 0;
  let skipped = 0;
  let failed = 0;
  const errors = [];

  for (const wf of definitions) {
    if (existingNames.has(wf.name)) {
      console.log(`[workflows] already exists, skipping: ${wf.name}`);
      skipped++;
      continue;
    }

    try {
      const res = await fetch(`${HS_API}/automation/v4/flows`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(wf),
      });

      if (!res.ok) {
        const errBody = await res.text();
        const msg = `${wf.name}: HTTP ${res.status} — ${errBody}`;
        console.error(`[workflows] failed: ${msg}`);
        errors.push(msg);
        failed++;
      } else {
        console.log(`[workflows] created: ${wf.name}`);
        created++;
      }
    } catch (err) {
      const msg = `${wf.name}: ${err.message}`;
      console.error(`[workflows] error: ${msg}`);
      errors.push(msg);
      failed++;
    }
  }

  console.log(`[workflows] done — created: ${created}, skipped: ${skipped}, failed: ${failed}`);
  if (failed > 0) throw new Error(errors.join(' | '));
}

module.exports = { createWorkflows, WORKFLOW_DEFINITIONS };
