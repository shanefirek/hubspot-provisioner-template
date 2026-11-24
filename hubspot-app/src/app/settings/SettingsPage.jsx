import { useState, useEffect } from 'react';
import {
  hubspot,
  Alert,
  Box,
  Button,
  Divider,
  Flex,
  Heading,
  LoadingSpinner,
  Tag,
  Text,
} from '@hubspot/ui-extensions';

const SERVER_URL = process.env.SERVER_URL || 'https://your-domain.com';

hubspot.extend(({ context }) => <SettingsPage portalId={context.portal.id} />);

function SettingsPage({ portalId }) {
  const [properties, setProperties] = useState(null);
  const [workflows, setWorkflows] = useState(null);
  const [lists, setLists] = useState(null);
  const [leadStatusOptions, setLeadStatusOptions] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [provisioning, setProvisioning] = useState(false);
  const [provisionOk, setProvisionOk] = useState(false);
  const [provisionError, setProvisionError] = useState(null);
  const [localKey, setLocalKey] = useState(0);

  useEffect(() => {
    setProperties(null);
    setWorkflows(null);
    setLists(null);
    setLeadStatusOptions(null);
    setLoadError(null);

    hubspot
      .fetch(`${SERVER_URL}/api/portals/${portalId}/properties/status`)
      .then((res) => res.json().then((d) => ({ ok: res.ok, d })))
      .then(({ ok, d }) => {
        if (!ok) throw new Error(d.error || 'Failed to load properties');
        setProperties(d.properties);
      })
      .catch((e) => setLoadError(e.message));

    hubspot
      .fetch(`${SERVER_URL}/api/portals/${portalId}/workflows/status`)
      .then((res) => res.json().then((d) => ({ ok: res.ok, d })))
      .then(({ ok, d }) => {
        if (!ok) throw new Error(d.error || 'Failed to load workflows');
        setWorkflows(d.workflows);
      })
      .catch((e) => setLoadError(e.message));

    hubspot
      .fetch(`${SERVER_URL}/api/portals/${portalId}/lists/status`)
      .then((res) => res.json().then((d) => ({ ok: res.ok, d })))
      .then(({ ok, d }) => {
        if (!ok) throw new Error(d.error || 'Failed to load lists');
        setLists(d.lists);
      })
      .catch((e) => setLoadError(e.message));

    hubspot
      .fetch(`${SERVER_URL}/api/portals/${portalId}/lead-status-options/status`)
      .then((res) => res.json().then((d) => ({ ok: res.ok, d })))
      .then(({ ok, d }) => {
        if (!ok) throw new Error(d.error || 'Failed to load lead status options');
        setLeadStatusOptions(d.options);
      })
      .catch((e) => setLoadError(e.message));
  }, [portalId, localKey]);

  function runProvisioning() {
    setProvisioning(true);
    setProvisionOk(false);
    setProvisionError(null);
    hubspot
      .fetch(`${SERVER_URL}/api/portals/${portalId}/provision`, { method: 'POST' })
      .then((res) => res.json().then((d) => ({ ok: res.ok, d })))
      .then(({ ok, d }) => {
        if (!ok) throw new Error(d.error || 'Provisioning failed');
        setProvisionOk(true);
        setLocalKey((k) => k + 1);
      })
      .catch((e) => setProvisionError(e.message))
      .finally(() => setProvisioning(false));
  }

  const pendingProperties = properties ? properties.filter((p) => !p.exists) : [];
  const pendingWorkflows = workflows ? workflows.filter((w) => !w.exists) : [];
  const pendingLists = lists ? lists.filter((l) => !l.exists) : [];
  const pendingLeadStatusOptions = leadStatusOptions ? leadStatusOptions.filter((o) => !o.exists) : [];
  const hasPending =
    pendingProperties.length > 0 ||
    pendingWorkflows.length > 0 ||
    pendingLists.length > 0 ||
    pendingLeadStatusOptions.length > 0;

  return (
    <Flex direction="column" gap="md">
      <Heading>HubSpot Provisioner Setup</Heading>

      {loadError && (
        <Alert title="Could not load status" variant="error">{loadError}</Alert>
      )}
      {provisionOk && (
        <Alert title="Provisioning completed successfully" variant="success" />
      )}
      {provisionError && (
        <Alert title="Provisioning failed" variant="error">{provisionError}</Alert>
      )}

      {hasPending && (
        <Button onClick={runProvisioning} disabled={provisioning} variant="primary">
          {provisioning ? 'Running provisioning…' : 'Run Provisioning'}
        </Button>
      )}

      <Heading>Properties</Heading>
      {!properties
        ? <LoadingSpinner label="Loading properties…" />
        : properties.map((p) => (
            <Flex key={p.name} direction="row" justify="between" align="center">
              <Flex direction="column" gap="extra-small">
                <Text format={{ fontWeight: 'bold' }}>{p.label}</Text>
                <Text format={{ color: 'medium' }}>{p.name}</Text>
              </Flex>
              <Tag variant={p.exists ? 'success' : 'warning'}>
                {p.exists ? '✓ Active' : '— Pending'}
              </Tag>
            </Flex>
          ))}

      <Divider />

      <Heading>Lead Status Options</Heading>
      <Text format={{ color: 'medium' }}>
        Options added to the standard hs_lead_status property so the provisioned workflows can set them.
      </Text>
      {!leadStatusOptions
        ? <LoadingSpinner label="Loading lead status options…" />
        : leadStatusOptions.map((o) => (
            <Flex key={o.value} direction="row" justify="between" align="center">
              <Flex direction="column" gap="extra-small">
                <Text format={{ fontWeight: 'bold' }}>{o.label}</Text>
                <Text format={{ color: 'medium' }}>{o.value}</Text>
              </Flex>
              <Tag variant={o.exists ? 'success' : 'warning'}>
                {o.exists ? '✓ Active' : '— Pending'}
              </Tag>
            </Flex>
          ))}

      <Divider />

      <Heading>Workflows</Heading>
      {!workflows
        ? <LoadingSpinner label="Loading workflows…" />
        : workflows.map((w) => (
            <Flex key={w.name} direction="row" justify="between" align="center">
              <Flex direction="column" gap="extra-small">
                <Text format={{ fontWeight: 'bold' }}>{w.name}</Text>
                {w.description && <Text format={{ color: 'medium' }}>{w.description}</Text>}
              </Flex>
              <Tag variant={w.exists ? 'success' : 'warning'}>
                {w.exists ? '✓ Active' : '— Pending'}
              </Tag>
            </Flex>
          ))}

      <Divider />

      <Heading>Lists</Heading>
      {!lists
        ? <LoadingSpinner label="Loading lists…" />
        : lists.map((l) => (
            <Flex key={l.name} direction="row" justify="between" align="center">
              <Flex direction="column" gap="extra-small">
                <Text format={{ fontWeight: 'bold' }}>{l.name}</Text>
                {l.description && <Text format={{ color: 'medium' }}>{l.description}</Text>}
              </Flex>
              <Tag variant={l.exists ? 'success' : 'warning'}>
                {l.exists ? '✓ Active' : '— Pending'}
              </Tag>
            </Flex>
          ))}

      <Box>
        <Button onClick={() => setLocalKey((k) => k + 1)} variant="secondary" size="small">
          Refresh
        </Button>
      </Box>
    </Flex>
  );
}
