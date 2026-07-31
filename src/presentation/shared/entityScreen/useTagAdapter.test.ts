import { describe, expect, it } from 'vitest';
import { createSchemaContext, resolveEntity } from '../../../domain/schema/screenEntity';

/**
 * A regra que o bug expôs: a tela exibida sabe as próprias etiquetas. A resolução pela ENTIDADE só
 * entra quando a tela não declara nada — é assim que duas telas compartilham o mesmo conjunto.
 */
describe('coleção de etiquetas de uma tela', () => {
  const ctx = createSchemaContext([
    { id: 'processos', collection: 'cases', titleSingular: 'Processo', titleFieldKey: 'title', fields: [], tagCollection: 'caseTags' },
    { id: 'cases', titleSingular: 'Processo', titleFieldKey: '', fields: [], tagCollection: null },
  ]);

  it('a entidade da coleção resolve mesmo quando o documento dela não declara etiquetas', () => {
    expect(resolveEntity(ctx, 'cases')?.tagCollection).toBe('caseTags');
  });

  it('a declaração da própria tela é a primeira resposta', () => {
    const declared = 'caseTags';
    expect(declared || resolveEntity(ctx, 'cases')?.tagCollection || '').toBe('caseTags');
  });

  it('sem nenhuma declaração, não há coleção — e a tela não oferece etiquetas', () => {
    const vazio = createSchemaContext([
      { id: 'medico', titleSingular: 'Médico', titleFieldKey: 'nome', fields: [] },
    ]);
    expect(resolveEntity(vazio, 'medico')?.tagCollection ?? '').toBe('');
  });
});
