import { describe, expect, it } from 'vitest';
import { EXAMPLE_NOTES } from '../src/sdk/node/exampleNotes';
import { EXAMPLE_SOURCES } from '../cli/src/vendor/exampleSources.js';

/**
 * A NOTA DE AUTORIA de cada exemplo, casada com os exemplos que de fato viajam.
 *
 * O par mora aqui, e não dentro de nenhum dos dois lados, porque os dois lados são de pacotes
 * diferentes e nenhum pode depender do outro: o TEXTO é do SDK, pela regra de que o que descreve o
 * kernel viaja com o kernel; a LISTA é do Console, que é quem empacota os exemplos. Um teste de escopo
 * do repositório é o único lugar em que as duas coisas se olham.
 *
 * E ele existe porque a alternativa é a que já falhou em outros três lugares: uma lista em prosa que
 * fica incompleta em silêncio. Um sétimo exemplo acrescentado ao empacotador chegaria ao escritório sem
 * nota, e a resposta do servidor MCP diria "sem nota" para sempre — sem reprovar em nada.
 */
describe('a nota de cada exemplo de autoria', () => {
  it('todo exemplo que viaja no pacote tem nota', () => {
    const missing = Object.keys(EXAMPLE_SOURCES).filter((folder) => EXAMPLE_NOTES[folder] === undefined);
    expect(missing, `sem nota em exampleNotes.ts: ${missing.join(', ')}`).toEqual([]);
  });

  /** O inverso também: uma nota para uma pasta que ninguém empacota descreve algo que não chega lá. */
  it('e nenhuma nota descreve um exemplo que não viaja', () => {
    const orphan = Object.keys(EXAMPLE_NOTES).filter((folder) => EXAMPLE_SOURCES[folder] === undefined);
    expect(orphan, `nota órfã: ${orphan.join(', ')}`).toEqual([]);
  });

  /**
   * A nota responde à pergunta da AUTORIA — qual mecanismo se aprende ali —, e não à do produto, que
   * `description` e `overview` já respondem. Uma nota curta demais é uma que voltou a ser rótulo.
   */
  it('cada nota diz um mecanismo, não um rótulo', () => {
    for (const [folder, note] of Object.entries(EXAMPLE_NOTES)) {
      expect(note.length, folder).toBeGreaterThan(80);
      expect(note.trim(), folder).toBe(note);
    }
  });
});
