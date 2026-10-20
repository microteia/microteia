import { describe, expect, it, vi } from 'vitest';
import { createPluginHost } from '../../kernel';
import { CORE_PLUGINS } from '..';
import { UI_RECORD_ACTION_POINT } from '../../domain/schema/ui/uiExtensionPoints';
import type { UiRecordActionMetadata } from '../../domain/schema/ui/uiExtensionPoints';
import { isActionHidden } from '../../domain/schema/actionExpression';
import type { ActionExprContext } from '../../domain/schema/actionExpression';
import { SCREEN_ICON_KEYS } from '../../domain/schema/ui/screenIconCatalog';
import { RECORD_ACTION_METADATA, unlinkCommand } from './recordActionCommands';
import type { RecordActionHost } from '../../presentation/shared/recordActions/recordActionHost';
import type { ResolvedRecordAction } from '../../presentation/shared/recordActions/useRecordActions';
import {
  gestureRowsFrom,
  listActionOptionsFrom,
  moveListActionSlot,
} from '../../presentation/pages/ScreenBuilder/ScreenBuilder.viewmodel';
import { inScreenOrder } from '../../presentation/shared/recordActions/screenOrder';

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
  it('as seis chegam pelo ponto de extensão, com implementação resolvível — gerar documento vem do core.documents', () => {
    const host = createPluginHost();
    host.load(CORE_PLUGINS);

    const contributions = host.contributions.query(UI_RECORD_ACTION_POINT);
    const keys = contributions.map((c) => (c.metadata as unknown as UiRecordActionMetadata).key);
    expect(keys.sort()).toEqual(['clone', 'copyLink', 'delete', 'generateDocument', 'manageTags', 'unlink']);

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

  it('o gesto do Form Design sai das contribuições, não de uma lista escrita à mão', () => {
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

/**
 * Os gestos ficavam numa aba "Listagem" feita só de caixas, longe da aba "Ações", e o cartão os
 * desenhava na ordem da contribuição: quem configurava a tela não os achava, e não tinha como
 * reordená-los.
 */
describe('o escritório ordena os gestos da plataforma', () => {
  it('o cartão segue a ordem de listActions, não a da contribuição', () => {
    const ordered = inScreenOrder(builtinResolved(), ['delete', 'copyLink']);
    expect(ordered.map((action) => action.metadata.key)).toEqual(['delete', 'unlink', 'copyLink']);
  });

  it('o slot que a tela não habilitou não aparece', () => {
    expect(inScreenOrder(builtinResolved(), ['clone']).map((action) => action.slot)).toEqual(['clone']);
  });

  it('os ligados vêm primeiro, na ordem configurada, e só eles se movem', () => {
    const rows = gestureRowsFrom(listActionOptionsFrom(builtinResolved()), ['delete', 'copyLink']);
    expect(rows.slice(0, 2).map((row) => [row.key, row.enabled, row.canMoveUp, row.canMoveDown])).toEqual([
      ['delete', true, false, true],
      ['copyLink', true, true, false],
    ]);
    expect(rows.slice(2).every((row) => !row.enabled && !row.canMoveUp && !row.canMoveDown)).toBe(true);
  });

  it('mover pula o slot gravado cuja ação não está instalada, e o mantém no lugar', () => {
    const visible = new Set(['copyLink', 'delete']);
    expect(moveListActionSlot(['copyLink', 'exportPdf', 'delete'], visible, 'delete', -1))
      .toEqual(['delete', 'exportPdf', 'copyLink']);
    expect(moveListActionSlot(['copyLink', 'delete'], visible, 'copyLink', -1)).toEqual(['copyLink', 'delete']);
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
      contractId: 'c1',
      activePoleIds: ['c1', 'x2'],
      passivePoleIds: ['x3'],
    },
    collection: 'cases',
    screenKey: 'processos',
    surface: 'parentTab',
    parent: { fieldKeys: ['contractId'], recordId: 'c1', required: false },
    recordTabKey: 'view-dyn:processos:r1',
    cloneTabKey: 'new-dyn:processos:clone:r1',
    openTab: vi.fn(),
    notify: vi.fn(),
    patchRecord: vi.fn(async () => {}),
    copyText: vi.fn(async () => {}),
    openTagManager: vi.fn(),
    openDialog: vi.fn(),
    requestDelete: vi.fn(),
    ...overrides,
  });

  it('limpa o campo que aponta para o pai — e nada mais', async () => {
    const h = host();
    await unlinkCommand(h);
    expect(h.patchRecord).toHaveBeenCalledWith({ contractId: null });
    expect(h.requestDelete).not.toHaveBeenCalled();
  });

  it('vínculo obrigatório é recusado com aviso, sem gravar nada', async () => {
    const h = host({ parent: { fieldKeys: ['caseId'], recordId: 'p1', required: true } });
    await unlinkCommand(h);
    expect(h.patchRecord).not.toHaveBeenCalled();
    expect(h.notify).toHaveBeenCalledWith('action.unlink.required', 'error');
  });

  it('num campo multi, tira só o id do pai e deixa as outras partes', async () => {
    const h = host({ parent: { fieldKeys: ['activePoleIds'], recordId: 'c1', required: false } });
    await unlinkCommand(h);
    expect(h.patchRecord).toHaveBeenCalledWith({ activePoleIds: ['x2'] });
  });

  it('preso por vários campos, desfaz em todos os que apontam — e só neles', async () => {
    const h = host({ parent: { fieldKeys: ['activePoleIds', 'passivePoleIds', 'contractId'], recordId: 'c1', required: false } });
    await unlinkCommand(h);
    expect(h.patchRecord).toHaveBeenCalledWith({ activePoleIds: ['x2'], contractId: null });
  });

  it('sem pai não faz nada: não há vínculo a desfazer', async () => {
    const h = host({ parent: null });
    await unlinkCommand(h);
    expect(h.patchRecord).not.toHaveBeenCalled();
  });
});
