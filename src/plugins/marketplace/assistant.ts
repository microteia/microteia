import type { MarketplacePlugin } from '../../domain/entities/MarketplacePlugin';
import { settingsSection } from '../contributionBuilders';
import { accessPermissionContribution } from '../../domain/schema/access';
import { assistantMessagesContribution } from './assistantMessages';
import { assistantPtBrContribution } from './assistantMessagesPtBr';

const message = (key: string): string => `@com.microteia.assistant/${key}`;

/**
 * **AI Assistant** — the switch that turns on the chat pinned to the side of the workspace.
 *
 * Like AI Agent Access, the extension carries the DECISION and almost nothing else. The conversation
 * code, the reserved `assistantConversations` collection and the panel belong to the kernel; what this
 * package owns is `backend.functions`: the two Cloud Functions leave the package baseline and are
 * deployed only in the projects of offices that installed it. The panel appears when an installed
 * extension claims `assistantChat` — the kernel never asks for this package by name.
 *
 * It does not depend on AI Agent Access. The assistant uses the same tools, but calls them inside the
 * function with the signed-in person's permissions: no agent token is issued, and no MCP endpoint has
 * to be on the air.
 */
export const assistantPlugin: MarketplacePlugin = {
  manifest: {
    id: 'com.microteia.assistant',
    version: '1.0.0',
    kernel: '^2.0.0',
    name: message('package.name'),
    description: message('package.description'),
    category: message('package.category'),
    publisher: { name: 'Microteia' },
    contributes: [
      assistantMessagesContribution(),
      assistantPtBrContribution(),
      accessPermissionContribution({
        id: 'assistant.use',
        name: message('permission.use'),
        description: message('permission.use.description'),
      }),
      settingsSection({
        key: 'assistant',
        title: message('settings.section.title'),
        description: message('settings.section.description'),
        icon: 'sparkling',
        order: 36,
        properties: [
          {
            key: 'assistant.writeMode',
            label: message('settings.write-mode'),
            description: message('settings.write-mode.description'),
            type: 'select',
            default: 'confirm',
            options: [
              { value: 'confirm', label: message('settings.write-mode.confirm') },
              { value: 'auto', label: message('settings.write-mode.auto') },
              { value: 'off', label: message('settings.write-mode.off') },
            ],
            scopes: ['tenant'],
          },
          {
            key: 'assistant.contextTokens',
            label: message('settings.context-tokens'),
            description: message('settings.context-tokens.description'),
            type: 'number',
            default: 64000,
            min: 8000,
            max: 1000000,
            scopes: ['tenant'],
          },
        ],
      }),
    ],
    backend: {
      // The names spelled out, as an author outside would write them. `backendShape.test.ts` compares
      // them with what `functions/index.ts` exports.
      functions: ['assistantChat', 'assistantConversation'],
      // The conversation list asks for the person's own conversations, newest first. The index goes
      // with the extension so an office that never installed it does not carry it.
      indexes: [
        {
          collectionGroup: 'assistantConversations',
          queryScope: 'COLLECTION',
          fields: [
            { fieldPath: 'ownerId', order: 'ASCENDING' },
            { fieldPath: 'updatedAt', order: 'DESCENDING' },
          ],
        },
      ],
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
          { label: message('overview.limit'), value: message('overview.limit.value') },
          { label: message('overview.changes'), value: message('overview.changes.value') },
        ],
      },
    ],
  },
  workflows: [],
};
