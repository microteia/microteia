import { describe, expect, it } from 'vitest';
import {
  describeMisgated,
  misgatedTriggers,
  singleClaimants,
  triggerDeclarations,
  ungatedTriggerProblems,
  withoutComments,
} from './functionGate.js';
import type { GateSubject, TriggerDeclaration } from './functionGate.js';

/**
 * O portão de instalação é a metade da retirada que age no instante do clique — e era a metade que nada
 * cobrava. Um gatilho de extensão sem `forInstalledExtension` dispara para TODOS os escritórios do
 * projeto, inclusive os que nunca a instalaram, e o sintoma dele não é uma falha: é o código de uma
 * extensão que ninguém tem mais rodando sobre dados alheios, sem erro em lugar nenhum.
 *
 * Estes casos guardam as duas pontas. A primeira é não deixar passar o que está errado. A segunda, que
 * custa mais e vale mais, é não recusar o que está certo: a verificação que dá falso positivo é a que
 * ensina a próxima pessoa a desligá-la.
 */

const GATED = `import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { forInstalledExtension } from 'microteia-functions/office';

export const acmeOnSave = onDocumentWritten(
  { document: 'tenants/{tenantId}/invoices/{id}', region: 'southamerica-east1' },
  forInstalledExtension('com.acme.crm', async (event) => {
    console.log('acmeOnSave', event.params.tenantId);
  }),
);
`;

const UNGATED = `import { onDocumentWritten } from 'firebase-functions/v2/firestore';

export const acmeOnSave = onDocumentWritten(
  { document: 'tenants/{tenantId}/invoices/{id}', region: 'southamerica-east1' },
  async (event) => {
    console.log('acmeOnSave', event.params.tenantId);
  },
);
`;

const subject = (overrides: Partial<GateSubject> = {}): GateSubject => ({
  label: 'extensions/crm/functions',
  shared: false,
  exported: ['acmeOnSave'],
  triggers: [{ name: 'acmeOnSave', trigger: 'onDocumentWritten', gatedFor: null }],
  ...overrides,
});

const trigger = (overrides: Partial<TriggerDeclaration> = {}): TriggerDeclaration => ({
  name: 'acmeOnSave',
  trigger: 'onDocumentWritten',
  gatedFor: 'com.acme.crm',
  ...overrides,
});

describe('a fonte sem comentário', () => {
  /**
   * É o caso que a limpeza existe para pegar. O molde do `create function` EXPLICA o portão num JSDoc
   * acima do gatilho: sem tirar o comentário, apagar a chamada e manter a explicação passaria na
   * verificação — exatamente a forma que um autor produz ao mexer no código gerado.
   */
  it('tira o JSDoc que só CITA o portão, e com ele o falso negativo', () => {
    const source = `/** Runs with forInstalledExtension('com.acme.crm'). */
export const acmeOnSave = onDocumentWritten(opts, handler);`;

    expect(withoutComments(source)).not.toContain('forInstalledExtension');
    expect(triggerDeclarations(source)[0].gatedFor).toBeNull();
  });

  it('tira o comentário de linha sem juntar os tokens vizinhos', () => {
    expect(withoutComments('const a = 1; // nota\nconst b = 2;')).toContain('const b = 2;');
    expect(withoutComments('const/* meio */a = 1;')).toContain('const a = 1;');
  });

  it('não confunde as barras de uma URL dentro de string com um comentário', () => {
    expect(withoutComments("const url = 'https://example.com/a'; const x = 1;"))
      .toContain("'https://example.com/a'");
  });

  it('uma aspas não fechada não engole o resto do arquivo', () => {
    const cleaned = withoutComments("const broken = 'oops\nexport const after = 1;");
    expect(cleaned).toContain('export const after = 1;');
  });
});

describe('os gatilhos declarados numa fonte', () => {
  it('lê o nome, o construtor e o id do portão do gatilho que o molde escreve', () => {
    expect(triggerDeclarations(GATED)).toEqual([
      { name: 'acmeOnSave', trigger: 'onDocumentWritten', gatedFor: 'com.acme.crm' },
    ]);
  });

  it('marca sem portão o mesmo gatilho sem a chamada', () => {
    expect(triggerDeclarations(UNGATED)).toEqual([
      { name: 'acmeOnSave', trigger: 'onDocumentWritten', gatedFor: null },
    ]);
  });

  it('reconhece os quatro eventos de documento, e as variantes com contexto de autenticação', () => {
    for (const constructorName of [
      'onDocumentCreated', 'onDocumentUpdated', 'onDocumentDeleted', 'onDocumentWritten',
      'onDocumentWrittenWithAuthContext',
    ]) {
      const source = `export const x = ${constructorName}(opts, handler);`;
      expect(triggerDeclarations(source), constructorName)
        .toEqual([{ name: 'x', trigger: constructorName, gatedFor: null }]);
    }
  });

  /**
   * `onSchedule` e `onMessagePublished` não têm `{tenantId}` no caminho, e o portão falha FECHADO — um
   * agendado envolvido nele nunca roda, nem enquanto a extensão está instalada. Exigir deles um portão
   * que não funciona trocaria um defeito por outro, então eles não são gatilhos para esta verificação.
   */
  it('ignora o que não carrega escritório no caminho do evento', () => {
    expect(triggerDeclarations("export const nightly = onSchedule('every day 03:00', handler);")).toEqual([]);
    expect(triggerDeclarations('export const queue = onMessagePublished(topic, handler);')).toEqual([]);
    expect(triggerDeclarations('export const hello = onCall(opts, handler);')).toEqual([]);
  });

  /**
   * `onDocumentWritten(opts, gated)` com o portão declarado ao lado é o que se escreve quando o handler
   * cresce, e é código correto. Recusá-lo seria a verificação errando contra quem fez certo.
   */
  it('acha o portão declarado num identificador ao lado', () => {
    const source = `const gated = forInstalledExtension('com.acme.crm', async (event) => {});

export const acmeOnSave = onDocumentWritten({ document: 'tenants/{tenantId}/x/{id}' }, gated);`;

    expect(triggerDeclarations(source)[0].gatedFor).toBe('com.acme.crm');
  });

  it('aceita o id entre aspas duplas, que é a outra forma de escrever a mesma string', () => {
    expect(triggerDeclarations('export const x = onDocumentWritten(o, forInstalledExtension("com.a.b", h));')[0]
      .gatedFor).toBe('com.a.b');
  });

  it('lê o gatilho com anotação de tipo, sem confundir o tipo com a atribuição', () => {
    const source = "export const x: CloudFunction<Event> = onDocumentWritten(o, forInstalledExtension('com.a.b', h));";
    expect(triggerDeclarations(source)).toEqual([
      { name: 'x', trigger: 'onDocumentWritten', gatedFor: 'com.a.b' },
    ]);
  });

  /**
   * Um parêntese solto dentro de uma string desequilibraria a contagem e o portão cairia fora do trecho
   * lido — e o efeito seria recusar uma function correta, que é o pior desfecho possível aqui.
   */
  it('não se perde num parêntese que mora dentro de uma string', () => {
    const source = `export const x = onDocumentWritten(
  { document: 'tenants/{tenantId}/x/{id}' },
  forInstalledExtension('com.a.b', async () => { console.log('done :-)'); }),
);`;
    expect(triggerDeclarations(source)[0].gatedFor).toBe('com.a.b');
  });

  it('lê os dois gatilhos de um arquivo que declara dois', () => {
    const source = `export const first = onDocumentCreated(o, forInstalledExtension('com.a.b', h));
export const second = onDocumentDeleted(o, h);`;

    expect(triggerDeclarations(source).map((entry) => [entry.name, entry.gatedFor])).toEqual([
      ['first', 'com.a.b'],
      ['second', null],
    ]);
  });
});

describe('o gatilho de extensão sem portão', () => {
  it('é recusado nomeando a origem, a function e o construtor', () => {
    const problems = ungatedTriggerProblems([subject()]);

    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('extensions/crm/functions exports "acmeOnSave"');
    expect(problems[0]).toContain('onDocumentWritten trigger with no installation gate');
    expect(problems[0]).toContain('forInstalledExtension');
    expect(problems[0]).toContain('every office in the project');
  });

  it('não reclama do que está com o portão', () => {
    expect(ungatedTriggerProblems([subject({ triggers: [trigger()] })])).toEqual([]);
  });

  /**
   * Uma function escrita e não exportada não é deployada. Reclamar dela mandaria procurar um problema
   * que não existe — é a mesma política que já vale para as callables.
   */
  it('não reclama de um gatilho que o index.ts não exporta', () => {
    expect(ungatedTriggerProblems([subject({ exported: [] })])).toEqual([]);
  });

  /**
   * `functions/` é comum a várias extensões: nenhuma a reivindica, e não há um id para o portão receber.
   * Exigir aqui um portão impossível recusaria a única forma que a plataforma oferece para uma function
   * compartilhada.
   */
  it('não cobra portão da function comum, que não tem instalação de onde perguntar', () => {
    expect(ungatedTriggerProblems([subject({ label: 'functions', shared: true })])).toEqual([]);
  });
});

describe('o portão aberto para o id de outra extensão', () => {
  const claimants = new Map([['acmeOnSave', 'com.acme.crm']]);

  it('é apontado com os dois ids, e devolve o dono para ser pendurado', () => {
    const found = misgatedTriggers(
      [subject({ triggers: [trigger({ gatedFor: 'com.other.thing' })] })],
      claimants,
    );

    expect(found).toEqual([{
      label: 'extensions/crm/functions',
      name: 'acmeOnSave',
      gatedFor: 'com.other.thing',
      owner: 'com.acme.crm',
    }]);
    expect(describeMisgated(found[0])).toContain('gates "acmeOnSave" for "com.other.thing"');
    expect(describeMisgated(found[0])).toContain('the extension that claims it is "com.acme.crm"');
    expect(describeMisgated(found[0])).toContain('the gate never opens');
  });

  it('nada a dizer quando o id do portão é o de quem reivindica', () => {
    expect(misgatedTriggers([subject({ triggers: [trigger()] })], claimants)).toEqual([]);
  });

  it('nada a dizer sobre um gatilho sem portão — esse é o outro problema', () => {
    expect(misgatedTriggers([subject()], claimants)).toEqual([]);
  });

  it('nada a dizer quando extensão nenhuma reivindica aquele nome', () => {
    expect(misgatedTriggers([subject({ triggers: [trigger()] })], new Map())).toEqual([]);
  });
});

describe('quem reivindica cada nome', () => {
  const claim = (pluginId: string, functions: string[]) => ({ pluginId, backend: { functions } });

  it('mapeia o nome para a extensão que o declara', () => {
    expect(singleClaimants([claim('com.a.b', ['x', 'y'])])).toEqual(new Map([['x', 'com.a.b'], ['y', 'com.a.b']]));
  });

  it('a mesma extensão em dois escritórios continua sendo um dono só', () => {
    expect(singleClaimants([claim('com.a.b', ['x']), claim('com.a.b', ['x'])]))
      .toEqual(new Map([['x', 'com.a.b']]));
  });

  /**
   * Dois donos é problema de `functionClaimProblems`, que recusa antes. Eleger um deles aqui inventaria
   * uma resposta — e a resposta errada apontaria o portão CERTO como errado.
   */
  it('deixa de fora o nome disputado por duas extensões, em vez de escolher uma', () => {
    expect(singleClaimants([claim('com.a.b', ['x']), claim('com.c.d', ['x'])])).toEqual(new Map());
  });

  it('não se importa com uma extensão que não declara function nenhuma', () => {
    expect(singleClaimants([{ pluginId: 'com.a.b', backend: {} }])).toEqual(new Map());
  });
});
