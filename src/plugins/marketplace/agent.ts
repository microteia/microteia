import type { MarketplacePlugin } from '../../domain/entities/MarketplacePlugin';
import { settingsSection } from '../contributionBuilders';
import { agentMessagesContribution } from './agentMessages';
import { agentPtBrContribution } from './agentMessagesPtBr';

const message = (key: string): string => `@com.microteia.agent/${key}`;

/**
 * **AI Agent Access** — the switch that puts the office's MCP endpoint in the air.
 *
 * The extension carries almost nothing, and that is the point of it. What it does carry is the one
 * thing declaring cannot replace: `backend.functions`. The three Cloud Functions it claims leave the
 * package baseline and are deployed ONLY in the projects of offices that installed it — so an office
 * that never wanted this has no HTTP endpoint in the air at all, which is a stronger guarantee than
 * any check made at request time.
 *
 * The three functions are the kernel's, not this extension's, and so are the `agentGrants` collection
 * and the `agent.manage` permission — for the same reason `aiConnections` and `ai.manage` are: the
 * collection is reserved, the callables validate against the office's own permission catalog, and the
 * screen that issues an access needs that catalog. What an extension can own is the DECISION to have
 * the feature; what it cannot own is a reserved collection of the platform.
 *
 * That split is also what makes the runtime gate possible without the kernel naming this package.
 * `agentMcp` does not ask "is com.microteia.agent installed?" — it asks "does any installed, active
 * extension claim the function named agentMcp?". The kernel names only what is its own, the answer
 * stays data belonging to the office, and forking this package into another one keeps working.
 */
export const agentPlugin: MarketplacePlugin = {
  manifest: {
    id: 'com.microteia.agent',
    version: '1.2.0',
    kernel: '^2.0.0',
    name: message('package.name'),
    description: message('package.description'),
    category: message('package.category'),
    publisher: { name: 'Microteia' },
    contributes: [
      agentMessagesContribution(),
      agentPtBrContribution(),
      settingsSection({
        key: 'agent',
        title: message('settings.section.title'),
        description: message('settings.section.description'),
        icon: 'sparkling',
        order: 35,
        properties: [
          {
            key: 'agent.selfServiceGrants',
            label: message('settings.self-service'),
            description: message('settings.self-service.description'),
            type: 'boolean',
            default: true,
            scopes: ['tenant'],
          },
        ],
      }),
    ],
    backend: {
      // Os nomes por extenso, e não importados de uma constante do kernel: é o que um autor de
      // extensão realmente escreve, e este arquivo viaja como material de leitura dele. A coerência
      // com o que o `functions/index.ts` exporta é cobrada por `backendShape.test.ts`, que compara
      // as duas pontas — o que nenhum import resolveria de todo modo, já que o autor de fora não tem
      // acesso às constantes daqui.
      functions: [
        'agentMcp',
        'createAgentGrant',
        'revokeAgentGrant',
        'agentOAuth',
        'getAgentAuthRequest',
        'consentAgentAuthRequest',
      ],
      // Sem `prerequisites`: o passo de liberar a invocação pública é do KERNEL
      // (`functions-invoker`), vale para toda instalação, e o `deploy` já imprime a lista exata das
      // functions que precisam dele — `agentMcp` inclusive, agora que ele conta como chamável de
      // fora. Repeti-lo aqui faria a mesma orientação chegar duas vezes, e as duas envelheceriam
      // separadas.
    },
  },
  summary: message('package.summary'),
  overview: {
    type: 'stack',
    gap: 'lg',
    children: [
      { type: 'markdown', content: message('overview.body') },
      {
        type: 'keyValue',
        items: [
          { label: message('overview.connection'), value: message('overview.connection.value') },
          { label: message('overview.sign-in'), value: message('overview.sign-in.value') },
          { label: message('overview.token'), value: message('overview.token.value') },
          { label: message('overview.limit'), value: message('overview.limit.value') },
        ],
      },
    ],
  },
  workflows: [],
};
