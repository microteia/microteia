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
    version: '1.1.0',
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
      {
        type: 'markdown',
        content:
          '**AI Agent Access** lets an AI assistant work inside this office, on the office own data, '
          + 'without any access to the database.\n\n'
          + '- Each person gets **their own access**, and it is always **theirs**: it carries their name, '
          + 'their permissions and nobody else\'s.\n'
          + '- The access declares **which permissions it may use** and, if you want, **when it expires**.\n'
          + '- An access can **never do more than the person who holds it**: lose a role, and every access '
          + 'of yours narrows on the next call.\n'
          + '- Any access can be **revoked at any time**, and it stops working immediately.\n\n'
          + 'There are two ways to connect, and the office does not have to choose one — both work at the '
          + 'same time, and both end up in the same list.\n\n'
          + '**Signing in.** The assistant asks only for the connection address. The person signs in with '
          + 'their own account, picks which permissions to allow, and that is it — no token is ever copied '
          + 'or pasted. Clients that can sign in, Claude on the web among them, should use this: it is what '
          + 'keeps one person\'s assistant from acting as another person.\n\n'
          + '**A token.** For a client that cannot sign in, an access issued in Organization → AI agents '
          + 'produces a token to paste into it. The token is shown once and stored only as a fingerprint, '
          + 'so a lost one is replaced, never recovered.\n\n'
          + 'Once connected, the assistant discovers the screens this office has and can search records, '
          + 'register them, change them, delete them, run a report and start an automation — each of those '
          + 'only when the access releases it.',
      },
      {
        type: 'keyValue',
        items: [
          { label: 'Connection', value: 'MCP over HTTP — nothing to install on the machine' },
          { label: 'Signing in', value: 'OAuth 2.1, each person with their own account — no token to copy' },
          { label: 'Or a token', value: 'An access token issued in the application, revocable, shown once' },
          { label: 'Limit', value: 'The permissions of the person who holds it, intersected with the ones the access declares' },
        ],
      },
    ],
  },
  workflows: [],
};
