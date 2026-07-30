import { describe, expect, it } from 'vitest';
import { pruneUndefined } from './pruneUndefined';

/**
 * O Firestore recusa `undefined` em QUALQUER profundidade — inclusive dentro de objetos de uma
 * lista. Era o que derrubava a gravação inteira da tela ao reordenar campos: um só opcional ausente
 * em `fields[]` invalidava o documento todo.
 */
describe('pruneUndefined', () => {
  it('remove opcional ausente dentro de objeto de lista', () => {
    const pruned = pruneUndefined({
      fields: [{ key: 'nome', order: 0, multi: undefined, options: undefined }],
    });

    expect(pruned.fields[0]).toEqual({ key: 'nome', order: 0 });
  });

  it('preserva null, que é o jeito de LIMPAR um valor gravado', () => {
    expect(pruneUndefined({ mask: null, section: undefined })).toEqual({ mask: null });
  });

  it('não descarta valores falsos legítimos', () => {
    expect(pruneUndefined({ required: false, order: 0, label: '' }))
      .toEqual({ required: false, order: 0, label: '' });
  });
});
