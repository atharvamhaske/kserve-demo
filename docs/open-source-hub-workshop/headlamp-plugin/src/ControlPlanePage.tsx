import { SectionBox } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  Grid,
  Link,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import React from 'react';
import {
  AIGatewayRoute,
  Condition,
  Event,
  Gateway,
  Instance,
  InstanceUser,
  Pod,
  Provider,
  SecurityPolicy,
} from './resources';

interface StatusShape {
  conditions?: Condition[];
  parents?: Array<{ conditions?: Condition[] }>;
  ancestors?: Array<{ conditions?: Condition[] }>;
}

const failureConditionTypes: Record<string, true> = {
  Ready: true,
  Accepted: true,
  Programmed: true,
  ResolvedRefs: true,
};

function statusConditions(resource: Gateway | AIGatewayRoute | SecurityPolicy): Condition[] {
  const status = resource.jsonData.status as StatusShape | undefined;
  return [
    ...(status?.conditions || []),
    ...(status?.parents?.flatMap(parent => parent.conditions || []) || []),
    ...(status?.ancestors?.flatMap(ancestor => ancestor.conditions || []) || []),
  ];
}

function failureMessage(conditions: Condition[]): string {
  const failed = conditions.find(
    condition => condition.status === 'False' && failureConditionTypes[condition.type]
  );
  return failed ? [failed.reason, failed.message].filter(Boolean).join(': ') : '';
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <Card variant="outlined">
      <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
        <Typography variant="caption" color={tone || 'text.secondary'} sx={{ fontWeight: 600 }}>
          {label}
        </Typography>
        <Typography variant="h4" color={tone || 'text.primary'} sx={{ fontWeight: 700, mt: 0.5 }}>
          {value}
        </Typography>
      </CardContent>
    </Card>
  );
}

export function ControlPlanePage() {
  const [providers, providerError] = Provider.useList();
  const [instances, instanceError] = Instance.useList();
  const [users, userError] = InstanceUser.useList();
  const [gateways, gatewayError] = Gateway.useList();
  const [routes, routeError] = AIGatewayRoute.useList();
  const [policies, policyError] = SecurityPolicy.useList();
  const [pods, podError] = Pod.useList();
  const [events, eventError] = Event.useList();

  const providerRows = providers || [];
  const instanceRows = instances || [];
  const userRows = users || [];
  const gatewayRows = [
    ...(gateways || []).map(resource => ({ kind: 'Gateway', resource, conditions: statusConditions(resource) })),
    ...(routes || []).map(resource => ({ kind: 'AIGatewayRoute', resource, conditions: statusConditions(resource) })),
    ...(policies || []).map(resource => ({ kind: 'SecurityPolicy', resource, conditions: statusConditions(resource) })),
  ];
  const failedInstances = instanceRows.filter(
    instance => instance.phase === 'Failed' || failureMessage(instance.conditions)
  );
  const failedProviders = providerRows.filter(
    provider => provider.phase === 'Failed' || failureMessage(provider.conditions)
  );
  const failedGatewayResources = gatewayRows.filter(row => failureMessage(row.conditions));
  const unhealthyPods = (pods || []).filter(pod => pod.issue);
  const warningEvents = (events || [])
    .filter(event => event.jsonData.type === 'Warning')
    .sort((left, right) => {
      const leftTime = left.jsonData.eventTime || left.jsonData.lastTimestamp || '';
      const rightTime = right.jsonData.eventTime || right.jsonData.lastTimestamp || '';
      return rightTime.localeCompare(leftTime);
    })
    .slice(0, 20);
  const failures =
    failedInstances.length +
    failedProviders.length +
    failedGatewayResources.length +
    unhealthyPods.length;
  const errors = [
    providerError,
    instanceError,
    userError,
    gatewayError,
    routeError,
    policyError,
    podError,
    eventError,
  ].filter(Boolean);

  return (
    <SectionBox>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
          LLM Control Plane
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          OpenEverest providers, KServe model instances, users, and Envoy AI Gateway health.
        </Typography>
      </Box>

      {errors.map((error, index) => (
        <Alert severity="error" sx={{ mb: 2 }} key={`${errorMessage(error)}-${index}`}>
          {errorMessage(error)}
        </Alert>
      ))}

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={2.4}>
          <SummaryCard label="Providers" value={providerRows.length} />
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <SummaryCard label="Models" value={instanceRows.length} />
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <SummaryCard label="Users" value={userRows.length} />
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <SummaryCard label="Gateway Objects" value={gatewayRows.length} />
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <SummaryCard label="Failures" value={failures} tone={failures > 0 ? 'error.main' : 'success.main'} />
        </Grid>
      </Grid>

      {unhealthyPods.map(pod => (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          key={`${pod.metadata.namespace}/${pod.metadata.name}`}
        >
          Pod {pod.metadata.namespace}/{pod.metadata.name}: {pod.issue}
        </Alert>
      ))}

      <Typography variant="h6" sx={{ mb: 1.5, fontWeight: 700 }}>
        Providers
      </Typography>
      <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Issue</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {providerRows.map(provider => {
              const issue =
                failureMessage(provider.conditions) ||
                (provider.phase === 'Failed' ? 'Provider failed' : '');
              return (
                <TableRow key={provider.metadata.name}>
                  <TableCell>{provider.metadata.name}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={provider.phase}
                      color={issue ? 'error' : 'success'}
                    />
                  </TableCell>
                  <TableCell>{issue || '-'}</TableCell>
                </TableRow>
              );
            })}
            {providerRows.length === 0 && (
              <TableRow>
                <TableCell colSpan={3}>No OpenEverest providers found.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Typography variant="h6" sx={{ mb: 1.5, fontWeight: 700 }}>
        Model Instances
      </Typography>
      <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Namespace</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Provider</TableCell>
              <TableCell>Model</TableCell>
              <TableCell>Access</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Issue</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {instanceRows.map(instance => {
              const issue =
                failureMessage(instance.conditions) ||
                instance.message ||
                (instance.phase === 'Failed' ? 'Instance failed' : '');
              return (
                <TableRow key={`${instance.metadata.namespace}/${instance.metadata.name}`}>
                  <TableCell>{instance.metadata.namespace}</TableCell>
                  <TableCell>{instance.metadata.name}</TableCell>
                  <TableCell>{instance.provider}</TableCell>
                  <TableCell>{instance.model}</TableCell>
                  <TableCell>{instance.externalAccess}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={instance.phase}
                      color={instance.phase === 'Ready' ? 'success' : issue ? 'error' : 'warning'}
                    />
                  </TableCell>
                  <TableCell>{issue || '-'}</TableCell>
                </TableRow>
              );
            })}
            {instanceRows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7}>No OpenEverest instances found.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Typography variant="h6" sx={{ mb: 1.5, fontWeight: 700 }}>
        Envoy AI Gateway
      </Typography>
      <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Kind</TableCell>
              <TableCell>Namespace</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Accepted</TableCell>
              <TableCell>Issue</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {gatewayRows.map(({ kind, resource, conditions }) => {
              const issue = failureMessage(conditions);
              const accepted = conditions.find(
                condition => condition.type === 'Accepted' || condition.type === 'Programmed'
              );
              return (
                <TableRow key={`${kind}/${resource.metadata.namespace}/${resource.metadata.name}`}>
                  <TableCell>{kind}</TableCell>
                  <TableCell>{resource.metadata.namespace}</TableCell>
                  <TableCell>{resource.metadata.name}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={accepted?.status || 'Unknown'}
                      color={accepted?.status === 'True' ? 'success' : issue ? 'error' : 'default'}
                    />
                  </TableCell>
                  <TableCell>{issue || '-'}</TableCell>
                </TableRow>
              );
            })}
            {gatewayRows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5}>No Gateway API resources found.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Typography variant="h6" sx={{ mb: 1.5, fontWeight: 700 }}>
        Instance Users
      </Typography>
      <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Namespace</TableCell>
              <TableCell>Username</TableCell>
              <TableCell>Instance</TableCell>
              <TableCell>Roles</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {userRows.map(user => (
              <TableRow key={`${user.metadata.namespace}/${user.metadata.name}`}>
                <TableCell>{user.metadata.namespace}</TableCell>
                <TableCell>{user.username}</TableCell>
                <TableCell>{user.instanceName}</TableCell>
                <TableCell>{user.roles}</TableCell>
              </TableRow>
            ))}
            {userRows.length === 0 && (
              <TableRow>
                <TableCell colSpan={4}>No InstanceUser resources found.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Typography variant="h6" sx={{ mb: 1.5, fontWeight: 700 }}>
        Recent Warning Events
      </Typography>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Namespace</TableCell>
              <TableCell>Object</TableCell>
              <TableCell>Reason</TableCell>
              <TableCell>Message</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {warningEvents.map(event => (
              <TableRow key={`${event.metadata.namespace}/${event.metadata.name}`}>
                <TableCell>{event.metadata.namespace}</TableCell>
                <TableCell>
                  {event.jsonData.involvedObject?.kind}/{event.jsonData.involvedObject?.name}
                </TableCell>
                <TableCell>{event.jsonData.reason || '-'}</TableCell>
                <TableCell>{event.jsonData.message || '-'}</TableCell>
              </TableRow>
            ))}
            {warningEvents.length === 0 && (
              <TableRow>
                <TableCell colSpan={4}>No warning events found.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Box sx={{ mt: 2 }}>
        <Link href="https://github.com/atharvamhaske/kserve-demo/tree/main/docs/open-source-hub-workshop" target="_blank" rel="noreferrer">
          Workshop runbooks and recovery scripts
        </Link>
      </Box>
    </SectionBox>
  );
}
