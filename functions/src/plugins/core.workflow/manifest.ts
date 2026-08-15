import type { PluginRecord } from '../../kernel';
import { WORKFLOW_EXTENSION_POINTS } from '../workflowExtensionPoints';

export const coreWorkflowPlugin: PluginRecord = {
  trusted: true,
  manifest: {
    id: 'core.workflow',
    version: '1.0.0',
    kernel: '^1.0.0',
    name: '@core.automation/plugin.workflow.name',
    description:
      '@core.automation/plugin.workflow.description',
    extensionPoints: WORKFLOW_EXTENSION_POINTS,
  },
};
