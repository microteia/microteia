import { describe, expect, it, vi } from 'vitest';
import { createPluginHost } from '../../kernel';
import { CORE_PLUGINS } from '..';
import { UI_RECORD_ACTION_POINT } from '../../domain/schema/ui/uiExtensionPoints';
import type { UiRecordActionMetadata } from '../../domain/schema/ui/uiExtensionPoints';
import { isActionHidden } from '../../domain/schema/actionExpression';
import type { ActionExprContext } from '../../domain/schema/actionExpression';
import { SCREEN_ICON_KEYS } from '../../presentation/shared/screenIcons';
import { RECORD_ACTION_METADATA, unlinkCommand } from './recordActionCommands';
import type { RecordActionHost } from '../../presentation/shared/recordActions/recordActionHost';
import type { ResolvedRecordAction } from '../../presentation/shared/recordActions/useRecordActions';
import { listActionOptionsFrom } from '../../presentation/pages/ScreenBuilder/ScreenBuilder.viewmodel';

/** As cinco do core.records na forma em que a tela as consome. */
const builtinResolved = (): ResolvedRecordAction[] =>
  Object.values(RECORD_ACTION_METADATA).map((metadata) => ({
    slot: metadata.slot ?? metadata.key,
    metadata,
    run: vi.fn(),
  }));

const metadataOf = (): UiRecordActionMetadata[] => {
  const host = createPluginHost();
  host.load(CORE_PLUGINS);
  return host.contributions
    .query(UI_RECORD_ACTION_POINT)
    .map((contribution) => contribution.metadata as unknown as UiRecordActionMetadata);
};

const ctx = (overrides: Partial<ActionExprContext>): ActionExprContext => ({
  values: {},
  record: {},
  isNew: false,
  isDirty: false,
  permissions: [],
  ...overrides,
});

/**
 * As quatro ações do cartão eram as ÚNICAS que o kernel sabia desenhar, escritas em código e ligadas
 * por caixa de seleção. Como contribuições, elas chegam à tela pelo mesmo caminho da ação de uma
 * extensão — e é isso que este teste guarda.
 */
describe('ações de registro — contribuições do core.records', () => {
  it('as cinco chegam pelo ponto de extensão, com implementação resolvível', () => {
    const host = createPluginHost();
    host.load(CORE_PLUGINS);

    const contributions = host.contributions.query(UI_RECORD_ACTION_POINT);
    const keys = contributions.map((c) => (c.metadata as unknown as UiRecordActionMetadata).key);
    expect(keys.sort()).toEqual(['clone', 'copyLink', 'delete', 'manageTags', 'unlink']);

    for (const contribution of contributions) {
      expect(contribution.impl?.kind).toBe('code');
      const impl = contribution.impl?.kind === 'code'
        ? host.implementations.resolve(contribution.pluginId, contribution.impl.key)
        : undefined;
      expect(typeof impl, `${contribution.id} sem implementação`).toBe('function');
    }
  });

  /** O ícone é chave do catálogo curado: um nome errado cairia no fallback em silêncio. */
  it('todo ícone declarado existe no catálogo de telas', () => {
    for (const metadata of metadataOf()) {
      expect(SCREEN_ICON_KEYS, `ícone "${metadata.icon}" (${metadata.key})`).toContain(metadata.icon);
    }
  });
});

/**
 * O que antes era um `if` no kernel — "se a aba é de um pai relacionado, troque Excluir por
 * Desvincular" — agora é a expressão de cada uma. As duas dividem o slot destrutivo e nunca
 * aparecem juntas.
 */
describe('o slot destrutivo é decidido por declaração', () => {
  it('excluir e desvincular disputam o mesmo slot', () => {
    expect(RECORD_ACTION_METADATA.unlink.slot).toBe('delete');
    expect(RECORD_ACTION_METADATA.delete.slot).toBeUndefined();
  });

  it.each([
    ['none', 'delete'],
    ['owned', 'delete'],
    ['related', 'unlink'],
  ] as const)('com relation=%s aparece %s', (relation, expected) => {
    const visible = (['delete', 'unlink'] as const).filter(
      (key) => !isActionHidden(RECORD_ACTION_METADATA[key].hiddenWhen, ctx({ relation })),
    );
    expect(visible).toEqual([expected]);
  });
});

/**
 * A porta que o ponto abriu só é porta se a CONFIGURAÇÃO da tela alcançar a ação nova. Enquanto
 * `ScreenListAction` foi uma união fechada e as caixas do Form Design uma lista literal, uma
 * extensão registrava a ação dela e nenhuma tela conseguia habilitá-la.
 */
describe('uma ação de extensão alcança a configuração da tela', () => {
  const extensionAction: ResolvedRecordAction = {
    slot: 'exportPdf',
    metadata: { key: 'exportPdf', title: 'Exportar PDF', icon: 'fileText', order: 9 },
    run: vi.fn(),
  };

  it('a caixa da aba "Listagem" sai das contribuições, não de uma lista escrita à mão', () => {
    const options = listActionOptionsFrom([...builtinResolved(), extensionAction]);
    expect(options.map((option) => option.key)).toContain('exportPdf');
  });

  it('excluir e desvincular são UMA caixa: dividem o slot', () => {
    const options = listActionOptionsFrom(builtinResolved());
    expect(options.filter((option) => option.key === 'delete')).toHaveLength(1);
    // O rótulo é REFERÊNCIA de mensagem: quem a resolve é o ponto de render, não a montagem da caixa.
    expect(options.find((option) => option.key === 'delete')?.label).toBe('@core.ui/action.delete');
  });

  it('a caixa carrega a dependência de etiquetas que a ação declarou', () => {
    const options = listActionOptionsFrom(builtinResolved());
    expect(options.find((option) => option.key === 'manageTags')?.requiresTags).toBe(true);
    expect(options.find((option) => option.key === 'clone')?.requiresTags).toBe(false);
  });
});

describe('desvincular', () => {
  const host = (overrides: Partial<RecordActionHost> = {}): RecordActionHost => ({
    // O tradutor de teste devolve a própria chave: aqui o que importa é QUE avisou, não a frase.
    t: (key: string) => key,
    record: {
      id: 'r1',
      tenantId: 't1',
      collection: 'cases',
      createdAt: new Date(),
      createdBy: 'u1',
      updatedAt: new Date(),
    },
    collection: 'cases',
    screenKey: 'processos',
    surface: 'parentTab',
    parent: { fieldKey: 'contractId', recordId: 'c1' },
    recordTabKey: 'view-dyn:processos:r1',
    cloneTabKey: 'new-dyn:processos:clone:r1',
    openTab: vi.fn(),
    notify: vi.fn(),
    patchRecord: vi.fn(async () => {}),
    copyText: vi.fn(async () => {}),
    openTagManager: vi.fn(),
    requestDelete: vi.fn(),
    ...overrides,
  });

  it('limpa o campo que aponta para o pai — e nada mais', async () => {
    const h = host();
    await unlinkCommand(h);
    expect(h.patchRecord).toHaveBeenCalledWith({ contractId: null });
    expect(h.requestDelete).not.toHaveBeenCalled();
  });

  it('sem pai não faz nada: não há vínculo a desfazer', async () => {
    const h = host({ parent: null });
    await unlinkCommand(h);
    expect(h.patchRecord).not.toHaveBeenCalled();
  });
});
