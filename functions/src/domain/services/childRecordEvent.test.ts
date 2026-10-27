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

  it('o carimbo do hash depois do anexo não publica de novo — o evento da criação já o levou', () => {
    const hash = 'a'.repeat(64);
    expect(childRecordEvent({ ...base, before: { name: 'a' }, after: { name: 'a', sha256: hash } })).toBeNull();
    expect(childRecordEvent({ ...base, before: null, after: { name: 'a', sha256: hash } })?.payload)
      .toMatchObject({ sha256: hash });
    expect(childRecordEvent({ ...base, before: { name: 'a' }, after: { name: 'b', sha256: hash } })?.payload)
      .toMatchObject({ changeType: 'updated', name: 'b' });
  });

  it('a troca do token do link permanente não publica — o arquivo é o mesmo', () => {
    const before = { name: 'a.pdf', url: 'https://f/a?token=old' };
    const after = { name: 'a.pdf', url: 'https://f/a?token=new', portalLinkSeal: 'new' };
    expect(childRecordEvent({ ...base, before, after })).toBeNull();
  });

  it('numa nota, `url` é dado como outro qualquer', () => {
    const event = childRecordEvent({ ...base, kind: 'note', before: { url: 'a' }, after: { url: 'b' } });
    expect(event?.payload.changeType).toBe('updated');
  });

  it('pai apagado ou sem tela leva só o id', () => {
    expect(childRecordEvent({ ...base, parentData: null, before: null, after: { name: 'a' } })?.payload.parent)
      .toEqual({ id: 'p1' });
    expect(childRecordEvent({ ...base, parentEntity: undefined, before: null, after: { name: 'a' } })?.payload.parent)
      .toEqual({ id: 'p1' });
  });
});
