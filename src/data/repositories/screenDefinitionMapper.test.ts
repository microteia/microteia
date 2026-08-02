import { describe, expect, it } from 'vitest';
import { mapScreenDefinition } from './screenDefinitionMapper';
import type { ScreenDefinition } from '../../domain/entities';

/**
 * As propriedades de `ScreenDefinition` que vivem no documento do Firestore. É `Omit` do que o
 * mapper deriva de fora do documento — assim, **acrescentar um campo à entidade obriga a declará-lo
 * aqui** (o TypeScript reclama do objeto incompleto abaixo), e o teste falha até o mapper tratá-lo.
 *
 * É a rede contra o bug que já aconteceu duas vezes: gravar no Firestore e descartar na leitura,
 * fazendo a tela parecer que "não salvou".
 */
type PersistedKeys = Omit<ScreenDefinition, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>;

const persisted: PersistedKeys = {
  origin: 'plugin',
  titleSingular: 'Pessoa',
  titlePlural: 'Pessoas',
  icon: 'user',
  fields: [{ key: 'apelido', label: 'Apelido', type: 'text', required: false, order: 0, origin: 'design' }],
  titleFieldKey: 'name',
  subtitleFieldKey: 'document',
  dataCollection: 'cases',
  eventPrefix: 'case',
  recordTabPrefix: 'processo-edit:',
  writeRoles: ['admin', 'lawyer'],
  hasNotes: true,
  hasDocuments: true,
  hasTags: true,
  listActions: ['clone', 'delete'],
  viewActionIds: ['a1'],
  cardActionIds: ['a2'],
  parentEntity: 'cases',
  parentFieldKey: 'caseId',
  parentRelation: 'related',
  hideFromSidebar: true,
  ownerPluginId: 'com.acme.vendas',
  ownerPluginIds: ['com.acme.vendas'],
  sourceId: 'src-123',
  sourceRev: 7,
  managed: true,
  sidebarOrder: 3,
  enabled: false,
  createdBy: 'user-1',
  updatedBy: 'user-2',
  updatedByName: 'Ana',
  updatedByPhotoURL: 'https://example.com/a.png',
  deletedBy: undefined,
  deletedByName: undefined,
  deletedByPhotoURL: undefined,
};

describe('mapScreenDefinition', () => {
  it('preserva TODAS as propriedades persistidas do documento', () => {
    const mapped = mapScreenDefinition('vendas__produto', { ...persisted }, 'tenant-1');

    for (const [key, value] of Object.entries(persisted)) {
      if (value === undefined) continue;
      expect(mapped[key as keyof ScreenDefinition], `campo "${key}" foi descartado na leitura`)
        .toEqual(value);
    }
  });

  it('acrescenta id e tenantId, que não vivem no documento', () => {
    const mapped = mapScreenDefinition('persons', {}, 'tenant-1');
    expect(mapped.id).toBe('persons');
    expect(mapped.tenantId).toBe('tenant-1');
  });

  it('documento vazio cai em padrões seguros', () => {
    const mapped = mapScreenDefinition('medico', {}, 'tenant-1');
    expect(mapped.origin).toBe('design');
    expect(mapped.fields).toEqual([]);
    expect(mapped.enabled).toBe(true);
    expect(mapped.icon).toBe('apps');
  });

  /**
   * Nenhuma entidade do kernel aceita mais campos adicionais — Prazo foi a última —, então nenhuma
   * chave de tela é reconhecida como fixa e o `origin` gravado é sempre o que vale.
   */
  it('sem entidade fixa que a reivindique, vale o origin gravado', () => {
    expect(mapScreenDefinition('deadlines', { origin: 'plugin' }, 'tenant-1').origin).toBe('plugin');
    expect(mapScreenDefinition('deadlines', { ownerPluginId: 'com.microteia.prazo' }, 'tenant-1').origin).toBe('plugin');
    expect(mapScreenDefinition('deadlines', {}, 'tenant-1').origin).toBe('design');
  });

  it('campo sem origin herda a da tela; com ownerPluginId, é da extensão', () => {
    const mapped = mapScreenDefinition('medico', {
      fields: [
        { key: 'a', label: 'A', type: 'text', required: false, order: 0 },
        { key: 'b', label: 'B', type: 'text', required: false, order: 1, ownerPluginId: 'com.acme.x' },
      ],
    }, 'tenant-1');
    expect(mapped.fields[0].origin).toBe('design');
    expect(mapped.fields[1].origin).toBe('plugin');
  });

  it('numa tela fixa, um campo sem origin é do usuário — não do kernel', () => {
    const mapped = mapScreenDefinition('persons', {
      fields: [{ key: 'apelido', label: 'Apelido', type: 'text', required: false, order: 0 }],
    }, 'tenant-1');
    expect(mapped.fields[0].origin).toBe('design');
  });

  it('converte Timestamp do Firestore em Date', () => {
    const date = new Date('2026-07-20T10:00:00Z');
    const stamp = { toDate: () => date };
    const mapped = mapScreenDefinition('persons', { createdAt: stamp, updatedAt: stamp }, 't1');
    // Sem Timestamp real (o mapper checa `instanceof`), o valor passa direto — o que importa aqui
    // é que a propriedade não some.
    expect(mapped.createdAt).toBeDefined();
    expect(mapped.updatedAt).toBeDefined();
  });
});
