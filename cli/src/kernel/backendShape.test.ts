import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { repoRoot } from '../shared/paths.js';
import {
  BACKEND_PENDING_REASONS,
  backendFingerprint,
  baselineFunctionsOf,
  baselineIndexesOf,
  claimedFunctions,
  claimsFromTemplates,
  baselineClaimProblems,
  functionClaimProblems,
  sharedClaimProblems,
  indexDeclarationProblems,
  indexKey,
} from './backendShape.js';
import type { BackendClaim, FirestoreIndexSpec } from './backendShape.js';
import { exportedFunctionNames } from './manifest.js';
import { firstPartyTemplates } from '../vendor/firstPartyTemplates.js';
import { AGENT_BACKEND_FUNCTIONS } from '../../../src/domain/schema/agent/agentBackend';
import { ASSISTANT_BACKEND_FUNCTIONS } from '../../../src/domain/schema/assistant/assistantBackend';

/**
 * A MESMA porta que o `pack` usa. Ler o diretório aqui por conta própria já custou cinco casos
 * vermelhos: o teste que guarda a conta do empacotamento passou a enxergar um pacote que o
 * empacotamento não enxerga, e a divergência entre os dois leitores é justamente o que ele existe
 * para impedir.
 */
const templates = (): { manifest?: Record<string, unknown> }[] =>
  firstPartyTemplates<{ manifest?: Record<string, unknown> }>(repoRoot);

const rootIndexes = (): FirestoreIndexSpec[] =>
  (JSON.parse(readFileSync(join(repoRoot, 'firestore.indexes.json'), 'utf8')) as {
    indexes: FirestoreIndexSpec[];
  }).indexes;

const allFunctions = (): string[] =>
  exportedFunctionNames(readFileSync(join(repoRoot, 'functions/src/index.ts'), 'utf8'));

describe('paridade do fingerprint entre o kernel e o Console', () => {
  /**
   * Separados em silêncio, o Console gravaria um carimbo que o kernel nunca reconhece — e a extensão
   * ficaria pendente para sempre, sem erro em lugar nenhum. Este teste compara as duas implementações
   * sobre os mesmos valores, em vez de comparar o texto das duas funções.
   */
  it('as duas implementações produzem a mesma string', async () => {
    const kernel = await import('../../../src/domain/schema/plugin/backendRequirement.js');
    const cases = [
      undefined,
      {},
      { functions: ['integracaoSync', 'integracaoAuth'] },
      { parameters: ['EXAMPLE_CLIENT_SECRET', 'EXAMPLE_CLIENT_ID'] },
      {
        functions: ['b', 'a'],
        parameters: ['Z', 'A'],
        indexes: [
          {
            collectionGroup: 'entradas',
            queryScope: 'COLLECTION' as const,
            fields: [
              { fieldPath: 'origemId', order: 'ASCENDING' as const },
              { fieldPath: 'chave', order: 'ASCENDING' as const },
            ],
          },
          {
            collectionGroup: 'tarefas',
            queryScope: 'COLLECTION_GROUP' as const,
            fields: [{ fieldPath: 'tags', arrayConfig: 'CONTAINS' as const }, { fieldPath: 'dueDate' }],
          },
        ],
      },
      { prerequisites: [{ id: 'x', title: 'y', detail: 'z' }] },
    ];

    for (const value of cases) {
      expect(backendFingerprint(value), JSON.stringify(value)).toBe(kernel.backendFingerprint(value));
    }
  });

  // Com a fonte das functions no pacote o hash entra no fingerprint — e SEM ela a string tem de ser a de
  // sempre, ou toda instalação já carimbada voltaria a ficar pendente.
  it('o hash da fonte entra igual nas duas pontas, e só quando existe', async () => {
    const kernel = await import('../../../src/domain/schema/plugin/backendRequirement.js');
    const backend = { functions: ['a'] };
    const hash = 'f'.repeat(64);
    expect(backendFingerprint(backend, hash)).toBe(kernel.backendFingerprint(backend, hash));
    expect(backendFingerprint(backend, undefined)).toBe(backendFingerprint(backend));
    expect(backendFingerprint(backend, hash)).not.toBe(backendFingerprint(backend));
  });

  /**
   * Um motivo que só o Console conhece é descartado pela leitura do kernel (`isBackendPendingReason`),
   * e a tela volta à instrução genérica — o defeito que o motivo existe para fechar.
   */
  it('os motivos de pendência são os mesmos nas duas pontas', async () => {
    const kernel = await import('../../../src/domain/schema/plugin/backendRequirement.js');
    expect([...BACKEND_PENDING_REASONS]).toEqual([...kernel.BACKEND_PENDING_REASONS]);
  });
});

describe('baseline e reivindicado — as contas do pacote', () => {
  it('baseline ∪ reivindicado é exatamente o que o index.ts exporta', () => {
    const all = allFunctions();
    const claims = claimsFromTemplates(templates());
    const baseline = baselineFunctionsOf(all, claims);
    const claimed = claimedFunctions(claims);

    expect([...baseline, ...claimed].sort()).toEqual([...all].sort());
    // Nenhuma function em dois lugares: o `--prune` decide pela ausência de dono, e um nome em ambos
    // seria removido de uma instalação que ainda o usa.
    expect(baseline.filter((name) => claimed.includes(name))).toEqual([]);
  });

  it('a baseline preserva a ordem do index.ts — é a ordem do deploy uma-a-uma', () => {
    const all = allFunctions();
    const baseline = baselineFunctionsOf(all, claimsFromTemplates(templates()));
    expect(baseline).toEqual(all.filter((name) => baseline.includes(name)));
  });

  it('toda function reivindicada existe no pacote, e nenhuma tem dois donos', () => {
    expect(functionClaimProblems(claimsFromTemplates(templates()), allFunctions())).toEqual([]);
  });

  it('todo índice reivindicado está declarado na raiz — declarar não pode inventar índice', () => {
    expect(indexDeclarationProblems(claimsFromTemplates(templates()), rootIndexes())).toEqual([]);
  });

  it('baseline de índices e reivindicados não se sobrepõem, e juntos são a raiz', () => {
    const claims = claimsFromTemplates(templates());
    const root = rootIndexes();
    const baseline = baselineIndexesOf(root, claims);
    const claimedKeys = new Set(claims.flatMap((claim) => (claim.backend.indexes ?? []).map(indexKey)));

    expect(baseline.some((index) => claimedKeys.has(indexKey(index)))).toBe(false);
    expect(baseline.length + claimedKeys.size).toBe(root.length);
  });

  /**
   * A subtração, que é o mecanismo inteiro: o que uma extensão reivindica SAI da baseline, e o resto
   * continua subindo sempre.
   *
   * O caso que motivou tudo isto eram as cinco functions do Gmail, de `com.microteia.push` — hoje
   * mantida fora deste repositório, junto com as functions dela. É por isso que a reivindicação aqui é
   * SINTÉTICA: nenhuma extensão de primeira parte reivindica function do kernel neste momento, e
   * amarrar o teste a uma que reivindicasse o faria falhar no dia em que ela saísse — que é justamente
   * o dia em que se quer saber que o mecanismo continua de pé.
   */
  it('o que uma extensão reivindica sai da baseline; o do kernel continua nela', () => {
    const claim: BackendClaim = {
      pluginId: 'com.example.integracao',
      name: 'Integração de exemplo',
      version: '1.0.0',
      backend: { functions: ['runScript'] },
    };

    const baseline = baselineFunctionsOf(allFunctions(), [claim]);
    expect(baseline).not.toContain('runScript');
    // O que é do kernel continua na baseline, ou uma instalação nova subiria sem motor de automações.
    expect(baseline).toContain('onWorkflowEventCreated');
    expect(baseline).toContain('callAIProxy');
    // E a conta fecha: baseline ∪ reivindicado continua sendo tudo o que o pacote exporta.
    expect([...baseline, ...claimedFunctions([claim])].sort()).toEqual([...allFunctions()].sort());
  });

  /**
   * A EXCLUSÃO, afirmada — e não deduzida do silêncio do caso acima.
   *
   * "Nenhuma reivindica" é verdade tanto quando o filtro funciona quanto quando não há exemplo com
   * backend nenhum, e as duas ficam indistinguíveis no dia em que o filtro quebrar. Este caso lê o
   * diretório CRU, encontra o exemplo que reivindica, e exige que a porta o tenha deixado de fora.
   */
  it('o exemplo que ensina Cloud Functions reivindica, e a porta o deixa de fora', () => {
    const crus = readdirSync(join(repoRoot, 'extension-templates'))
      .filter((file) => file.endsWith('.json'))
      .map((file) => JSON.parse(readFileSync(join(repoRoot, 'extension-templates', file), 'utf8')) as {
        manifest?: Record<string, unknown>;
      });

    const todos = claimsFromTemplates(crus).map((claim) => claim.pluginId);
    expect(todos, 'algum exemplo precisa reivindicar backend, ou este caso não prova nada')
      .toContain('com.microteia.backend-example');
    expect(claimsFromTemplates(templates()).map((claim) => claim.pluginId)).not.toContain(
      'com.microteia.backend-example',
    );
  });

  /**
   * QUEM reivindica backend hoje, afirmado por extenso.
   *
   * Este caso já disse "nenhuma", e o comentário de então prometia que ele avisaria no dia em que
   * uma passasse a reivindicar. Ele avisou: o Acesso de Agente de IA traz três Cloud Functions, e a
   * razão de elas serem reivindicadas em vez de baseline é a que vale para qualquer uma — um
   * escritório que nunca quis o recurso não tem por que ter um endpoint HTTP no ar.
   *
   * A lista continua sendo uma AFIRMAÇÃO, e não um `length > 0`: uma reivindicação acrescentada sem
   * intenção — por um `manifest.backend` copiado de outra extensão, digamos — tira uma function da
   * baseline e ela deixa de subir para todo mundo, em silêncio. É o defeito que este caso pega.
   */
  it('as extensões de primeira parte que reivindicam backend são exatamente estas', () => {
    const reivindicacoes = claimsFromTemplates(templates());

    expect(reivindicacoes.map((claim) => claim.pluginId).sort()).toEqual(['com.microteia.agent', 'com.microteia.assistant']);
    // Contra as CONSTANTES do domínio, e não contra uma lista escrita aqui: o `plugin.ts` da extensão
    // escreve os nomes por extenso — como um autor de fora escreveria —, e é esta comparação que
    // impede o manifest e o `functions/index.ts` de divergirem em silêncio.
    expect(reivindicacoes.flatMap((claim) => claim.backend.functions ?? []).sort())
      .toEqual([...AGENT_BACKEND_FUNCTIONS, ...ASSISTANT_BACKEND_FUNCTIONS].sort());
    // O primeiro índice de extensão: a lista de conversas do assistente. Ele está TAMBÉM na raiz, e é
    // o `pack` que confere as duas pontas — aqui só se afirma qual é, para que um segundo não entre
    // sem alguém olhar.
    expect(reivindicacoes.flatMap((claim) => claim.backend.indexes ?? []).map((index) => index.collectionGroup))
      .toEqual(['assistantConversations']);
    expect(reivindicacoes.flatMap((claim) => claim.backend.parameters ?? [])).toEqual([]);
  });

  it('reivindicação inválida é NOMEADA, e não silenciada', () => {
    const claim: BackendClaim = {
      pluginId: 'com.acme.x',
      name: 'Acme',
      version: '1.0.0',
      backend: { functions: ['naoExiste'] },
    };
    const problems = functionClaimProblems([claim], allFunctions());
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('com.acme.x');
    expect(problems[0]).toContain('naoExiste');
  });

  it('duas extensões donas da mesma function é problema, e o relato nomeia as duas', () => {
    const claim = (pluginId: string): BackendClaim => ({
      pluginId, name: pluginId, version: '1.0.0', backend: { functions: ['runScript'] },
    });
    const problems = functionClaimProblems([claim('com.acme.a'), claim('com.acme.b')], allFunctions());
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('com.acme.a');
    expect(problems[0]).toContain('com.acme.b');
  });

  /**
   * Reivindicar um nome da BASELINE passava por todas as conferências: ele está empacotado, e é só isso
   * que `functionClaimProblems` pergunta. As duas consequências não apareciam em lugar nenhum — o
   * `deploy` sobe a function de qualquer jeito, e desinstalar a extensão fazia `--prune` apagar um
   * gatilho do produto num escritório que não fez nada.
   */
  it('reivindicar uma function da plataforma é problema, mesmo estando empacotada', () => {
    const claim: BackendClaim = {
      pluginId: 'com.acme.x',
      name: 'Acme',
      version: '1.0.0',
      backend: { functions: ['auditFlatEntityChange'] },
    };
    expect(functionClaimProblems([claim], allFunctions())).toEqual([]);

    const problems = baselineClaimProblems([claim], ['auditFlatEntityChange']);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('com.acme.x');
    expect(problems[0]).toContain('auditFlatEntityChange');
  });

  /** E o que a extensão de fato traz continua passando: a pergunta é só sobre a baseline. */
  it('a function da própria extensão não é reivindicação sobre a baseline', () => {
    const claim: BackendClaim = {
      pluginId: 'com.acme.x',
      name: 'Acme',
      version: '1.0.0',
      backend: { functions: ['acmeSync'] },
    };
    expect(baselineClaimProblems([claim], ['auditFlatEntityChange'])).toEqual([]);
  });
});

/**
 * A function COMUM do escritório — `functions/`, ao lado do `microteia.yaml` — tem o mesmo desfecho da
 * function da plataforma, e por isso a mesma recusa. Ela não tem dono por construção: é o lugar de quem
 * serve várias extensões, e o `deploy` a sobe sempre. Reivindicá-la não muda nada enquanto a extensão
 * está instalada, e no dia em que ela sai a function vira órfã, o `--prune` a apaga e o `deploy` seguinte
 * a repõe — com quem mais dependia dela perdendo o backend numa janela que nada explica.
 */
describe('reivindicar a function comum da instalação', () => {
  const claim = (functions: string[]): BackendClaim => ({
    pluginId: 'com.acme.x',
    name: 'Acme',
    version: '1.0.0',
    backend: { functions },
  });

  /**
   * Passava por tudo: `functionClaimProblems` confere contra o que EXISTE para deployar, e a comum
   * existe. Era a guarda que faltava ao lado da da baseline.
   */
  it('é problema, mesmo sendo um nome que de fato existe para deployar', () => {
    const deployable = [...allFunctions(), 'acmeRecalcTotals'];
    expect(functionClaimProblems([claim(['acmeRecalcTotals'])], deployable)).toEqual([]);

    const problems = sharedClaimProblems([claim(['acmeRecalcTotals'])], ['acmeRecalcTotals']);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('com.acme.x');
    expect(problems[0]).toContain('acmeRecalcTotals');
    expect(problems[0]).toContain('shared function of this installation');
  });

  /** A function que mora em `extensions/<folder>/functions/` é justamente a que DEVE ser reivindicada. */
  it('a function da própria extensão não é reivindicação sobre a comum', () => {
    expect(sharedClaimProblems([claim(['acmeSync'])], ['acmeRecalcTotals'])).toEqual([]);
  });

  it('uma instalação sem function comum nenhuma não tem o que reclamar', () => {
    expect(sharedClaimProblems([claim(['acmeSync'])], [])).toEqual([]);
  });

  it('nomeia cada nome reivindicado, e não só o primeiro', () => {
    const problems = sharedClaimProblems([claim(['a', 'b'])], ['a', 'b']);
    expect(problems).toHaveLength(2);
  });

  it('não se importa com uma extensão que não declara function nenhuma', () => {
    const backendless: BackendClaim = {
      pluginId: 'com.acme.y',
      name: 'Acme',
      version: '1.0.0',
      backend: { parameters: ['TOKEN'] },
    };
    expect(sharedClaimProblems([backendless], ['acmeRecalcTotals'])).toEqual([]);
  });
});
