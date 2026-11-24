# HubSpot Provisioner — Template Repo

You are inside the **template** for a HubSpot Public App that auto-provisions a portal: 17 contact properties, 6 lead-status options, 3 contact lists, 6 workflows. One install on a target portal = a GTM-ready CRM in ~30 seconds.

This repo is the **recipe**. It is forked per deployment. **Nothing here should be deployment-specific** (no Railway URLs, no Client IDs, no secrets).

---

## Where this fits

```
Three repos, one product:

hubspot-provisioner-template/         ← YOU ARE HERE
  └── clean recipe; placeholders for URLs; bug fixes land here FIRST

hubspot-provisioner-personal/         ← Shane's deployment
  └── forked from this template; deployed to a Railway project
       under "Shane's GTM Projects"

hubspot-provisioner-<client>/         ← future client deployments
  └── one per client; forked from this template
```

If you're touching this repo, you're working on the recipe that every deployment uses. If you need to make a fix only for Shane's deploy or a specific client, you're in the wrong repo — go to that deployment's repo instead.

---

## Architecture (60-second tour)

```
hubspot-app/         Public App definition + React settings UI
├── hsproject.json
└── src/app/
    ├── app-hsmeta.json     OAuth scopes, redirect URL, permitted URLs
    └── settings/
        ├── SettingsPage.jsx        Embedded React UI inside HubSpot
        └── settings-page-hsmeta.json

server/              Express OAuth callback + provisioning pipeline
├── src/
│   ├── index.js                    Express app entry
│   ├── oauth.js                    POST /oauth/callback handler
│   ├── migrate.js                  Postgres migrations
│   ├── lib/
│   │   ├── db.js                   pg pool + token storage
│   │   ├── tokens.js               OAuth token refresh logic
│   │   └── hubspot.js              HubSpot SDK client factory
│   ├── routes/
│   │   └── portals.js              GET /api/portals/:id/{properties,lists,workflows,...}/status
│   │                                POST /api/portals/:id/provision
│   └── provisioning/
│       ├── index.js                Pipeline orchestrator + STEPS array
│       ├── properties.js           17 contact properties
│       ├── lead-status-options.js  6 hs_lead_status options + portal-value translation
│       ├── lists.js                3 contact lists
│       └── workflows.js            6 workflows (1 disabled by design)
├── .env.example
└── railway.toml                    NIXPACKS builder; runs migrate + index
```

## Provisioning pipeline (the STEPS)

`server/src/provisioning/index.js` runs four steps in this order. Order matters — dependencies flow downward.

1. **Properties** — creates 17 custom contact properties under group `provisioner_`. Idempotent (handles 409s).
2. **Lead Status Options** — patches `hs_lead_status` with 6 required options. Normalizes label-case across portal versions.
3. **Lists** — creates 3 DYNAMIC contact lists. References properties from step 1, so must run after.
4. **Workflows** — creates 6 workflows. References properties + lead status values. Must run after both above.

Originally there was a 5th step (`Dashboards`) but it was an empty stub that reported false-positive ✓; it was removed during the 2026-05-24 audit.

---

## Operating rules

### Commits
- No real names in commit messages (except Jordan Crawford / Jacob Dietle — public figures).
- No "reverse engineered" language. Use "API integration" or "undocumented API."
- No client names in commit messages. (The code can name a deployment — the commit history can't.)

### Memory
Do not use the auto-memory system. Everything lives in-repo.

### Railway infrastructure boundaries
- The **only** Railway workspace any deployment of this template should live in (for Shane's deployments) is `Shane's GTM Projects`.
- All other Railway workspaces are off-limits.
- Before any state-mutating Railway command (`railway up`, `railway link`, `railway variables set`, `railway delete`, `railway environment new`), verify context first:
  ```bash
  railway whoami
  railway status
  ```
- For client deployments, the rule generalizes: only deploy to workspaces explicitly authorized for that engagement.

---

## Where bug fixes belong

| Kind of change | Lands in |
|---|---|
| Provisioning bug (wrong filter type, missing scope, etc.) | **This repo (template)**, then cherry-pick into deployments |
| New property / workflow / list | **This repo**, then cherry-pick |
| Architectural refactor (e.g., spec/driver extraction) | **This repo** |
| URL config / secrets | Per-deployment repo — **NEVER this one** |
| Client-specific customization | Per-client repo — **NEVER this one** |

The signal: "would every deployment of this template benefit from this change?" If yes, it's a template change. If no, it's deployment-specific.

---

## Known open work

Tracked in `docs/audits/` — read the latest audit report for current state. As of 2026-05-25:

- **P0:** Replace `eventTypeId: '4-655002'` magic number in `workflows.js` with a named constant (it's HubSpot's standard contact-property-update event ID; verified portable across portals).
- **P1:** Add `--dry-run` mode to `runProvisioning` so iteration doesn't require redeploys.
- **P1:** Add snapshot tests on the HubSpot API payloads.
- **P0 (v1 audit, still standing):** Extract provisioning content from JS modules into a declarative `spec/` directory + driver layer. Required before any Salesforce/Attio sibling can reuse the pattern.
- **P1:** Add HubSpot signature verification (`X-HubSpot-Signature-v3`) to `/api/portals/*` routes.
- **P1:** Add a top-level README. (Yes, this one has been open since v1.)
- **P1:** Add a LICENSE.

---

## How to fork this for a deployment

Use the script:
```bash
~/projects/gtm-agent/scripts/onboard-hubspot-provisioner.sh <client-slug>
```

It clones this repo, deploys to Railway, walks through the HubSpot UI step, and outputs an install URL. See `~/projects/gtm-agent/scripts/onboard-hubspot-provisioner.md` for what it does and why.

---

## What's NOT in this repo (and shouldn't be)

- Any specific Railway URL → goes in the per-deployment repo + Railway env vars
- HubSpot Client ID / Client Secret → Railway env vars only
- Test data, test contacts → in the test portal, not in code
- Per-client property overrides → in a per-client repo
