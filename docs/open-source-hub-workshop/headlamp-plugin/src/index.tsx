import { registerRoute, registerSidebarEntry } from '@kinvolk/headlamp-plugin/lib';
import React from 'react';
import { ControlPlanePage } from './ControlPlanePage';

registerSidebarEntry({
  parent: null,
  name: 'openeverest-llm',
  label: 'LLM Control Plane',
  icon: 'mdi:server-network',
  url: '/openeverest/llm',
});

registerRoute({
  path: '/openeverest/llm',
  sidebar: 'openeverest-llm',
  component: () => <ControlPlanePage />,
  exact: true,
  name: 'openeverest-llm',
});
