// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ScreenDefinition } from '../../../domain/entities';

/**
 * A árvore "Conteúdo" lista o que o pacote leva — e ela é MISTA por natureza: telas e fluxos que o
 * escritório fez, com o nome que ele digitou, ao lado do que já vem embarcado de outra extensão, que
 * chega com a referência dela.
 *
 * Era metade em texto e metade em chave: `Pet1` na linha de baixo e
 * `@com.acme.auto/screen.request.plural` na de cima. Quem monta um pacote lê essa lista para decidir o
 * que entra, e uma das metades era ilegível.
 */
const CATALOG: Record<string, string> = {
  '@com.acme.auto/screen.request.plural': 'Solicitações',
  '@com.acme.auto/workflow.review': 'Revisar uma solicitação',
  '@com.acme.auto/action.review': 'Revisar',
  '@com.acme.auto/script.total': 'Somar valores',
};

// Parcial: a API curada do host reexporta o módulo inteiro, e trocá-lo por dois símbolos derrubaria
// o `hostApi` antes de o teste começar.
vi.mock('../../shared/i18n/useT', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../shared/i18n/useT')>()),
  useT: () => (key: string) => key,
  useLabel: () => (value: string | null | undefined) => CATALOG[value ?? ''] ?? (value ?? ''),
}));

// Do escritório: nome digitado por gente, e é ele que deve passar intacto.
const ownScreen = {
  id: 'pet1', tenantId: 't1', origin: 'design', titleSingular: 'Pet', titlePlural: 'Pet1',
  icon: 'team', fields: [], listActions: [], viewActionIds: [], cardActionIds: [],
  hasNotes: false, hasDocuments: false, hasTags: false, sidebarOrder: 10, enabled: true,
  createdAt: new Date(), createdBy: 'u1', updatedAt: new Date(),
} as unknown as ScreenDefinition;

// De outra extensão, já embarcado no pacote que se está editando.
const editingPackage = {
  manifest: {
    id: 'com.acme.auto', version: '1.0.0', kernel: '^2.0.0',
    name: '@com.acme.auto/package.name', description: '@com.acme.auto/package.description',
    publisher: { name: 'Acme' }, contributes: [],
  },
  summary: '@com.acme.auto/package.summary',
  screens: [{ key: 'request', titleSingular: '@com.acme.auto/screen.request', titlePlural: '@com.acme.auto/screen.request.plural', fields: [] }],
  actions: [{ templateId: 'act-review', key: 'review', title: '@com.acme.auto/action.review', workflowId: 'wf-review', order: 0, enabled: true }],
  workflows: [{ templateId: 'wf-review', name: '@com.acme.auto/workflow.review', eventName: 'workflow.called', steps: [] }],
  scripts: [{ templateId: 'sc-total', name: '@com.acme.auto/script.total', code: '' }],
};

vi.mock('../../../stores/useTenantExtensions', () => ({
  useTenantExtensions: () => ({
    saveExtension: vi.fn(),
    extensionOf: () => ({ package: editingPackage }),
  }),
}));
vi.mock('../../../stores/useWorkspace', () => ({ useWorkspace: () => ({ openTab: vi.fn() }) }));
vi.mock('../../../stores/useScreenDefinitions', () => ({
  useScreenDefinitions: () => ({ definitions: [ownScreen] }),
}));
vi.mock('../../../stores/useActions', () => ({ useActions: () => ({ actions: [] }) }));
vi.mock('../../../stores/useWorkflowStore', () => ({ useWorkflowStore: () => ({ workflows: [] }) }));
vi.mock('../../../stores/useScriptStore', () => ({ useScriptStore: () => ({ scripts: [] }) }));
vi.mock('../../../stores/useAuthorization', () => ({
  useAuthorization: () => ({ can: () => true, canAny: () => true, canAll: () => true }),
}));
vi.mock('../../../stores/useNotification', () => ({ useNotification: () => ({ notify: vi.fn() }) }));

const { usePluginAuthorViewModel } = await import('./PluginAuthor.viewmodel');

const rotulos = (groups: { options: { label: string }[] }[]) =>
  groups.flatMap((group) => group.options.map((option) => option.label));

describe('PluginAuthor — a árvore de conteúdo fala um idioma só', () => {
  it('o que vem embarcado de outra extensão aparece traduzido', () => {
    const { result } = renderHook(() => usePluginAuthorViewModel('plugin-author:com.acme.auto'));

    expect(rotulos(result.current.groups)).toContain('Solicitações');
    expect(rotulos(result.current.groups)).toContain('Revisar uma solicitação');
    expect(rotulos(result.current.groups)).toContain('Revisar');
    expect(rotulos(result.current.groups)).toContain('Somar valores');
  });

  it('o que o escritório digitou passa intacto, na mesma lista', () => {
    const { result } = renderHook(() => usePluginAuthorViewModel('plugin-author:com.acme.auto'));

    expect(rotulos(result.current.groups)).toContain('Pet1');
  });

  it('nenhuma linha da árvore chega com a referência crua', () => {
    const { result } = renderHook(() => usePluginAuthorViewModel('plugin-author:com.acme.auto'));

    rotulos(result.current.groups).forEach((rotulo) => {
      expect(rotulo.startsWith('@'), rotulo).toBe(false);
    });
  });

  it('o formulário guarda o valor REAL — é o que vai para o manifesto', () => {
    const { result } = renderHook(() => usePluginAuthorViewModel('plugin-author:com.acme.auto'));

    expect(result.current.form.name).toBe('@com.acme.auto/package.name');
    expect(result.current.form.summary).toBe('@com.acme.auto/package.summary');
  });
});
