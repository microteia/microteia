import type { PluginRecord } from '../kernel';
import { coreWorkflowPlugin } from './core.workflow/manifest';
import { coreStepsPlugin } from './core.steps/manifest';
import { coreAiStepsPlugin } from './core.ai.steps/manifest';
import { coreExpressionsPlugin } from './core.expressions/manifest';
import { coreCapabilitiesPlugin } from './core.capabilities/manifest';
import { coreAiPlugin } from './core.ai/manifest';
import { coreDataPlugin } from './core.data/manifest';

/**
 * Composition root dos plugins do backend — o ÚNICO lugar das Cloud Functions que conhece a lista
 * de plugins. Remover uma linha daqui remove os passos ou as funções daquele módulo do motor.
 */
export const BACKEND_PLUGINS: PluginRecord[] = [
  coreWorkflowPlugin,
  coreStepsPlugin,
  coreExpressionsPlugin,
  coreCapabilitiesPlugin,
  coreAiPlugin,
  coreAiStepsPlugin,
  coreDataPlugin,
];
