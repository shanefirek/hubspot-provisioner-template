# Post-Provision Manual Checks

Things to verify by hand after running provisioning on a new portal. Automation does not (yet) catch these — the provisioner blindly creates/patches and trusts label-or-value matching to dedupe, which can miss near-misses.

## Lead status options (`hs_lead_status`)

Source: `src/provisioning/lead-status-options.js`

After provisioning, open the contact property `hs_lead_status` in the portal UI and confirm there are no duplicate options. Risk cases:

- Portal already had an option with the same label but a different internal value (e.g. portal has `Meeting_Booked` with label `Meeting Booked`, provisioner adds `Meeting Booked` with label `Meeting Booked`). The diff in `diffLeadStatusOptions` matches on normalized label *and* value, but any drift in casing, punctuation, or trailing whitespace can slip past.
- Two options with visually identical labels but different internal values — workflows will only fire on one.

If duplicates exist, decide which internal value the workflows should target and either delete the extra option or update `CANONICAL_VALUE_TO_LABEL` to map to the portal's existing one.

## Custom meeting properties

Source: `src/provisioning/properties.js`

The provisioner creates these contact properties:

- `meeting_booked_time` (date) — `properties.js:98`
- `meeting_scheduled_date` (date) — `properties.js:113`

Before/after provisioning, check that the portal does not already have pre-existing properties with similar names or purpose (e.g. `meeting_date`, `last_meeting_booked`, a custom `Meeting Booked` date someone added manually). If a similar property exists, the new one will be created alongside it, and any historical data on the existing property will not feed our workflows.

Action if a conflict is found: either delete the redundant property, or update `properties.js` + `workflows.js` to reference the existing internal name instead of creating a new one.
