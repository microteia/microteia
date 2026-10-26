import { describe, expect, it } from 'vitest';
import { childRecordEvent } from './childRecordEvent';
import type { EntityMetadata } from '../schema/entityRegistry';

const entity = { referenceDenormFields: ['title'] } as unknown as EntityMetadata;

const base = {
  kind: 'document' as const,
  parentPrefix: 'order',
  parentId: 'p1',
  childId: 'd1',
  parentData: { title: 'Pedido 7', amount: 10 },
  parentEntity: entity,
};

describe('childRecordEvent', () => {
  it('nomeia o evento pelo prefixo da tela do pai, sem conhecer coleção nenhuma', () => {
    const event = childRecordEvent({ ...base, before: null, after: { name: 'a.pdf' } });
    expect(event?.name).toBe('order_document.saved');
    expect(event?.payload).toEqual({
      id: 'd1',
      parentId: 'p1',
      parentType: 'order',
      changeType: 'created',
      name: 'a.pdf',
      parent: { id: 'p1', title: 'Pedido 7' },
    });
  });

  it('a alteração leva "old" e a exclusão leva os dados de antes', () => {
    const updated = childRecordEvent({ ...base, kind: 'note', before: { text: 'a' }, after: { text: 'b' } });
    expect(updated?.name).toBe('order_note.saved');
    expect(updated?.payload).toMatchObject({ changeType: 'updated', old: { text: 'a' }, text: 'b' });

    const deleted = childRecordEvent({ ...base, before: { name: 'a.pdf' }, after: null });
    expect(deleted?.name).toBe('order_document.deleted');
    expect(deleted?.payload).toMatchObject({ name: 'a.pdf' });
    expect(deleted?.payload).not.toHaveProperty('changeType');
  });

  it('escrita que não mudou nada não publica', () => {
    expect(childRecordEvent({ ...base, before: { name: 'a' }, after: { name: 'a' } })).toBeNull();
    expect(childRecordEvent({ ...base, before: null, after: null })).toBeNull();
  });

  it('pai apagado ou sem tela leva só o id', () => {
    expect(childRecordEvent({ ...base, parentData: null, before: null, after: { name: 'a' } })?.payload.parent)
      .toEqual({ id: 'p1' });
    expect(childRecordEvent({ ...base, parentEntity: undefined, before: null, after: { name: 'a' } })?.payload.parent)
      .toEqual({ id: 'p1' });
  });
});
