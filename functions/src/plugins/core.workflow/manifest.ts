import type { PluginRecord } from '../../kernel';
import { WORKFLOW_EXTENSION_POINTS } from '../workflowExtensionPoints';

export const coreWorkflowPlugin: PluginRecord = {
  trusted: true,
  manifest: {
    id: 'core.workflow',
    version: '1.0.0',
    kernel: '^1.0.0',
    name: 'Motor de Automações',
    description: 'Declara os pontos de extensão do motor: passos e funções de expressão.',
    extensionPoints: WORKFLOW_EXTENSION_POINTS,
  },
};
