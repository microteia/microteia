import { describe, expect, it } from 'vitest';
import {
  changedRecordKeys,
  editWindowAllowsDelete,
  editWindowAllowsUpdate,
  editWindowClosesAt,
  isEditWindowOpen,
  readEditWindow,
  resolveEditWindow,
} from './editWindow';
import { createSchemaContext } from './screenEntity';

const CREATED = new Date('2026-10-24T12:00:00Z');
const INSIDE = new Date('2026-10-24T12:14:59Z');
const AT_CLOSE = new Date('2026-10-24T12:15:00Z');
const timestamp = (date: Date) => ({ toMillis: () => date.getTime() });

describe('readEditWindow — a declaração como a regra a lê', () => {
  it('ausente não é janela', () => {
    expect(readEditWindow(undefined)).toBeNull();
    expect(readEditWindow(null)).toBeNull();
  });

  it('a válida passa como está; `delete` só trava quando é `true`', () => {
    expect(readEditWindow({ minutes: 15, delete: true })).toEqual({ minutes: 15, delete: true });
    expect(readEditWindow({ minutes: 15, delete: false })).toEqual({ minutes: 15 });
  });

  it('a malformada FECHA, como na regra', () => {
    expect(readEditWindow({ minutes: 15.5 })).toEqual({ minutes: 0 });
    expect(readEditWindow({ minutes: 0, delete: true })).toEqual({ minutes: 0, delete: true });
    expect(readEditWindow(15)).toEqual({ minutes: 0, delete: true });
  });
});

describe('o prazo', () => {
  const spec = { minutes: 15 };

  it('conta de `createdAt`, venha como Date ou Timestamp, e fecha no instante exato', () => {
    expect(editWindowClosesAt(spec, CREATED)).toEqual(AT_CLOSE);
    expect(isEditWindowOpen(spec, timestamp(CREATED), INSIDE)).toBe(true);
    expect(isEditWindowOpen(spec, CREATED, AT_CLOSE)).toBe(false);
  });

  it('sem `createdAt` legível, está fechado — não aberto para sempre', () => {
    expect(editWindowClosesAt(spec, undefined)).toBeNull();
    expect(isEditWindowOpen(spec, 'ontem', INSIDE)).toBe(false);
  });
});

describe('o que passa depois do prazo', () => {
  const spec = { minutes: 15 };

  it('o conteúdo não passa; o campo de membro e o carimbo do repositório passam', () => {
    expect(editWindowAllowsUpdate(spec, CREATED, AT_CLOSE, { changedKeys: ['text'] })).toBe(false);
    expect(editWindowAllowsUpdate(spec, CREATED, AT_CLOSE, {
      changedKeys: ['readBy', 'updatedAt', 'updatedVia'],
      memberWritableFields: ['readBy'],
    })).toBe(true);
  });

  it('o carimbo de exclusão só passa quando a exclusão é livre', () => {
    const stamp = { changedKeys: ['deletedBy', 'deletedByName', 'deletedByPhotoURL'] };
    expect(editWindowAllowsUpdate(spec, CREATED, AT_CLOSE, stamp)).toBe(true);
    expect(editWindowAllowsUpdate({ minutes: 15, delete: true }, CREATED, AT_CLOSE, stamp)).toBe(false);
  });

  it('`createdAt` nunca muda, nem dentro do prazo — reabriria a janela', () => {
    expect(editWindowAllowsUpdate(spec, CREATED, INSIDE, { changedKeys: ['createdAt'] })).toBe(false);
  });

  it('excluir: livre sem `delete`; com ele, só dentro do prazo', () => {
    expect(editWindowAllowsDelete(spec, CREATED, AT_CLOSE)).toBe(true);
    expect(editWindowAllowsDelete({ minutes: 15, delete: true }, CREATED, INSIDE)).toBe(true);
    expect(editWindowAllowsDelete({ minutes: 15, delete: true }, CREATED, AT_CLOSE)).toBe(false);
  });
});

describe('changedRecordKeys — o affectedKeys da regra', () => {
  it('o valor reenviado igual não é alteração; instantes comparam pelo instante', () => {
    const before = { text: 'oi', tags: ['a'], when: timestamp(CREATED), meta: { x: 1 } };
    expect(changedRecordKeys(before, { text: 'oi', tags: ['a'], when: new Date(CREATED), meta: { x: 1 } })).toEqual([]);
    expect(changedRecordKeys(before, { text: 'olá', tags: ['a', 'b'], meta: { x: 2 } })).toEqual(['text', 'tags', 'meta']);
  });

  it('a chave nova conta, mesmo com valor vazio; `undefined` não é gravado e não conta', () => {
    expect(changedRecordKeys({ text: 'oi' }, { note: null, other: undefined })).toEqual(['note']);
  });
});

describe('resolveEditWindow — a janela da COLEÇÃO é a do documento que a regra lê', () => {
  it('uma tela que descreve a coleção de outra (`dataCollection`) não decide a janela', () => {
    const ctx = createSchemaContext([
      { id: 'chat', collection: 'messages', titleSingular: 'Chat', titleFieldKey: 'text', fields: [], editWindow: { minutes: 99 } },
      {
        id: 'messages',
        titleSingular: 'messages',
        titleFieldKey: '',
        fields: [],
        origin: 'builtin',
        editWindow: { minutes: 15, delete: true },
        memberWritableFields: ['readBy'],
      },
    ]);
    expect(resolveEditWindow(ctx, 'messages')).toEqual({
      spec: { minutes: 15, delete: true },
      memberWritableFields: ['readBy'],
    });
  });

  it('sem declaração, sem janela', () => {
    const ctx = createSchemaContext([{ id: 'notes', titleSingular: 'Note', titleFieldKey: 'text', fields: [] }]);
    expect(resolveEditWindow(ctx, 'notes')).toBeNull();
  });
});
