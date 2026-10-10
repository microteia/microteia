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
    icon: 'calendar', image: 'data:image/png;base64,iVBORw0KGgo=',
  },
  summary: '@com.acme.auto/package.summary',
  screens: [{ key: 'request', titleSingular: '@com.acme.auto/screen.request', titlePlural: '@com.acme.auto/screen.request.plural', fields: [] }],
  actions: [{ templateId: 'act-review', key: 'review', title: '@com.acme.auto/action.review', workflowId: 'wf-review', order: 0, enabled: true }],
  // O passo INCOMPLETO é de propósito: `call-workflow` exige `targetWorkflowId`, e é essa recusa que
  // a tela mostrava como "referencia a automação que pertence a outra extensão".
  workflows: [{
    templateId: 'wf-review',
    name: '@com.acme.auto/workflow.review',
    eventName: 'workflow.called',
    steps: [{ id: 'revisar', type: 'SubWorkflow', stepDefinitionId: 'call-workflow', configuration: {} }],
  }],
  scripts: [{ templateId: 'sc-total', name: '@com.acme.auto/script.total', code: '' }],
};

const origin = vi.hoisted(() => ({ value: 'authored' as 'authored' | 'imported' }));

vi.mock('../../../stores/useTenantExtensions', () => ({
  useTenantExtensions: () => ({
    saveExtension: vi.fn(),
    extensionOf: () => ({ package: editingPackage, origin: origin.value }),
  }),
}));
vi.mock('../../../stores/useInstalledExtensions', () => ({
  useInstalledExtensions: () => ({ installed: [] }),
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

/**
 * A recusa que o pacote produz chega à tela com a FRASE dela. Enquanto a tela escolhia a frase pela
 * presença de `ref`, toda recusa que sabe de qual artefato fala — e a integridade de passo sabe, com
 * o `ref` apontando a automação DONA do defeito — saía como a frase da referência pendente: "a
 * automação X referencia a automação X, que pertence a outra extensão", com o passo e o input, que a
 * frase certa nomeia, jogados fora.
 */
describe('PluginAuthor — a pendência do pacote diz o que ela é', () => {
  it('o defeito de um passo chega com a mensagem do passo', () => {
    const { result } = renderHook(() => usePluginAuthorViewModel('plugin-author:com.acme.auto'));

    expect(result.current.issues).toContain('@core.marketplace/issue.step.missing-input');
  });

  it('e nunca como a frase da referência pendente', () => {
    const { result } = renderHook(() => usePluginAuthorViewModel('plugin-author:com.acme.auto'));

    expect(result.current.issues).not.toContain('author.issue.external-ref');
  });
});

/**
 * O formulário reconstrói o manifesto só com o que conhece. Enquanto ícone e imagem não estavam nele,
 * salvar uma extensão editada os apagava em silêncio — e ela voltava ao marcador genérico na lista.
 */
describe('PluginAuthor — ícone e imagem sobrevivem à edição', () => {
  it('o formulário abre com o ícone e a imagem da extensão', () => {
    const { result } = renderHook(() => usePluginAuthorViewModel('plugin-author:com.acme.auto'));

    expect(result.current.form.icon).toBe('calendar');
    expect(result.current.form.image).toBe('data:image/png;base64,iVBORw0KGgo=');
  });

  it('e a imagem válida não vira pendência do pacote', () => {
    const { result } = renderHook(() => usePluginAuthorViewModel('plugin-author:com.acme.auto'));

    expect(result.current.issues.join(' ')).not.toContain('issue.package.image');
  });
});

/**
 * A extensão importada tem a fonte com quem a escreveu. Se a aba de edição dela chegar a abrir — o
 * workspace restaura abas —, a tela não oferece salvar nem exportar o que o store recusaria.
 */
describe('PluginAuthor — a extensão importada não se edita nem se exporta', () => {
  it('trava salvar e exportar', () => {
    origin.value = 'imported';
    try {
      const { result } = renderHook(() => usePluginAuthorViewModel('plugin-author:com.acme.auto'));
      expect(result.current.locked).toBe(true);
      expect(result.current.canSave).toBe(false);
      expect(result.current.canExport).toBe(false);
    } finally {
      origin.value = 'authored';
    }
  });

  it('a montada aqui segue editável', () => {
    const { result } = renderHook(() => usePluginAuthorViewModel('plugin-author:com.acme.auto'));
    expect(result.current.locked).toBe(false);
  });
});
