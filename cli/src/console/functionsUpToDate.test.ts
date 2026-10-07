import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { outdatedByStamp, planFunctionDeploy } from './functionsUpToDate.js';
import type { DeployedFunction } from './regionOrphans.js';

const repoRoot = join(import.meta.dirname, '../../..');
const REGION = 'southamerica-east1';

const deployedFunction = (
  name: string,
  overrides: Partial<DeployedFunction> = {},
): DeployedFunction => ({
  name,
  region: REGION,
  hash: 'a1b2c3',
  state: 'ACTIVE',
  platform: 'gcfv2',
  ...overrides,
});

/**
 * O que estes testes guardam é UMA propriedade, e ela é assimétrica de propósito: toda dúvida sobre
 * uma function tem de terminar em deploy. Pular é a única resposta que não dá para desfazer olhando
 * a saída — a function fica rodando código velho, sem erro em lugar nenhum.
 */
describe('o plano do deploy de functions', () => {
  it('agrupa pelo carimbo que o projeto já carrega', () => {
    const plan = planFunctionDeploy(
      ['callAIProxy', 'runWorkflow', 'onUserCreated'],
      [
        deployedFunction('callAIProxy'),
        deployedFunction('runWorkflow'),
        deployedFunction('onUserCreated', { hash: 'd4e5f6', platform: 'gcfv1' }),
      ],
      REGION,
    );

    expect(plan.unverifiable).toEqual([]);
    expect(plan.groups).toHaveLength(2);
    expect(plan.groups[0]).toEqual({
      hash: 'a1b2c3',
      platform: 'gcfv2',
      names: ['callAIProxy', 'runWorkflow'],
    });
    expect(plan.groups[1].names).toEqual(['onUserCreated']);
  });

  it('não agrupa duas plataformas, mesmo se o carimbo coincidisse', () => {
    const plan = planFunctionDeploy(
      ['callAIProxy', 'onUserCreated'],
      [
        deployedFunction('callAIProxy'),
        deployedFunction('onUserCreated', { platform: 'gcfv1' }),
      ],
      REGION,
    );

    expect(plan.groups).toHaveLength(2);
  });

  it('a que não está no projeto sobe, porque não há o que comparar', () => {
    const plan = planFunctionDeploy(['runWorkflow'], [], REGION);

    expect(plan.unverifiable).toEqual(['runWorkflow']);
    expect(plan.groups).toEqual([]);
  });

  it('a que não está ACTIVE sobe: ela está no meio de alguma coisa', () => {
    const plan = planFunctionDeploy(
      ['runWorkflow'],
      [deployedFunction('runWorkflow', { state: 'FAILED' })],
      REGION,
    );

    expect(plan.unverifiable).toEqual(['runWorkflow']);
  });

  it('a que não tem carimbo sobe: um CLI antigo a deployou sem o label', () => {
    const plan = planFunctionDeploy(
      ['runWorkflow'],
      [deployedFunction('runWorkflow', { hash: null })],
      REGION,
    );

    expect(plan.unverifiable).toEqual(['runWorkflow']);
  });

  it('a que está em outra região sobe: a cópia daqui não existe', () => {
    const plan = planFunctionDeploy(
      ['runWorkflow'],
      [deployedFunction('runWorkflow', { region: 'us-central1' })],
      REGION,
    );

    expect(plan.unverifiable).toEqual(['runWorkflow']);
  });

  it('não conseguir perguntar ao projeto sobe todas', () => {
    const plan = planFunctionDeploy(['a', 'b', 'c'], null, REGION);

    expect(plan.unverifiable).toEqual(['a', 'b', 'c']);
    expect(plan.groups).toEqual([]);
  });

  it('a sonda é o PRIMEIRO do grupo, e ela nunca é pulada', () => {
    const plan = planFunctionDeploy(
      ['callAIProxy', 'runWorkflow', 'runScript'],
      [deployedFunction('callAIProxy'), deployedFunction('runWorkflow'), deployedFunction('runScript')],
      REGION,
    );

    const [group] = plan.groups;
    expect(group.names[0]).toBe('callAIProxy');
    expect(group.names.slice(1)).toEqual(['runWorkflow', 'runScript']);
  });
});

/**
 * O outro lado: o provisionamento decidia por NOME, então a function de extensão cujo CÓDIGO mudou
 * seguia rodando a versão anterior sem que comando nenhum a alcançasse.
 */
describe('a function de extensão que ficou para trás', () => {
  const refreshed = new Map([['velho', 'novo']]);

  it('a aplicada que carrega o carimbo anterior volta para a fila', () => {
    const outdated = outdatedByStamp(
      ['gmailWatch'],
      [deployedFunction('gmailWatch', { hash: 'velho' })],
      REGION,
      refreshed,
    );

    expect(outdated.stale).toEqual(['gmailWatch']);
    expect(outdated.absent).toEqual([]);
  });

  it('a aplicada que já carrega o carimbo de agora fica quieta', () => {
    const outdated = outdatedByStamp(
      ['gmailWatch'],
      [deployedFunction('gmailWatch', { hash: 'novo' })],
      REGION,
      new Map([['novo', 'novo']]),
    );

    expect(outdated.stale).toEqual([]);
  });

  it('a aplicada que sumiu do projeto volta para a fila', () => {
    const outdated = outdatedByStamp(['gmailWatch'], [], REGION, refreshed);

    expect(outdated.absent).toEqual(['gmailWatch']);
  });

  it('a que o escritório pôs de propósito noutra região NÃO volta para a fila', () => {
    // Devolvê-la por não estar na região do pacote a redeployaria em toda execução, para sempre.
    const outdated = outdatedByStamp(
      ['gmailWatch'],
      [deployedFunction('gmailWatch', { region: 'us-central1', hash: 'velho' })],
      REGION,
      refreshed,
    );

    expect(outdated).toEqual({ absent: [], stale: [] });
  });

  it('a que está no projeto mas não está ACTIVE volta para a fila', () => {
    const outdated = outdatedByStamp(
      ['gmailWatch'],
      [deployedFunction('gmailWatch', { state: 'FAILED' })],
      REGION,
      refreshed,
    );

    expect(outdated.absent).toEqual(['gmailWatch']);
  });

  it('sem o carimbo de agora não há conclusão, e nada se move', () => {
    const outdated = outdatedByStamp(
      ['gmailWatch'],
      [deployedFunction('gmailWatch', { hash: 'velho' })],
      REGION,
      undefined,
    );

    expect(outdated.stale).toEqual([]);
    expect(outdated.absent).toEqual([]);
  });

  it('não conseguir perguntar ao projeto não move nada', () => {
    const outdated = outdatedByStamp(['gmailWatch'], null, REGION, refreshed);

    expect(outdated).toEqual({ absent: [], stale: [] });
  });
});

/**
 * O teste lê a fonte porque o que ele guarda é uma DECISÃO, e ela só teria efeito visível contra um
 * projeto Firebase de verdade: `--only functions:<nome>` marca a function como `targetedByOnly`, e é
 * isso que desliga o pulo do próprio `firebase` (`planner.js`). Perder qualquer uma das duas pontas
 * — o `--only` por nome, ou a comparação por carimbo — devolve o deploy de 28 functions a cada
 * execução, sem nada na saída dizendo que voltou.
 */
describe('a decisão fica onde ela é tomada', () => {
  const source = (path: string): string => readFileSync(join(repoRoot, 'cli/src', path), 'utf8');

  it('a listagem do projeto é feita UMA vez e serve às duas decisões', () => {
    const deploy = source('console/deploy.ts');

    expect(deploy).toContain('const deployedNow = await listDeployedFunctions(projectId);');
    expect(deploy).toContain("clearRegionOrphans(projectId, own, region, hasFlag(args, 'prune'), deployedNow)");
    expect(deploy).toContain('deployed: deployedNow');
  });

  it('o --all é o único desvio, e a instalação nova cai sozinha no caminho de sempre', () => {
    const deploy = source('console/deploy.ts');

    expect(deploy).toContain("all: hasFlag(args, 'all')");
    expect(deploy).not.toContain('all: firstInstall');
  });

  it('o que a sonda observou chega ao provisionamento', () => {
    const deploy = source('console/deploy.ts');
    const provision = source('console/provision.ts');

    expect(deploy).toContain('refreshedStamps = report.refreshed;');
    expect(deploy).toContain('refreshedStamps,');
    expect(provision).toContain('options.refreshedStamps)');
  });

  /**
   * O defeito: `microteia provision` sozinho nunca redeployava uma function de EXTENSÃO cujo código
   * tinha mudado. Ele só sabia comparar carimbos com o mapa que o `deploy` lhe entrega, e rodando
   * sozinho — que é o caminho de quem acabou de trocar de kernel por `unpack` — não havia mapa:
   * `outdatedByStamp` não tirava conclusão, a function ficava fora da fila, e o registro dizia
   * "aplicada" porque ela estava mesmo no ar — da versão anterior. Nada avisava.
   */
  it('o provisionamento sozinho SONDA, em vez de concluir que nada mudou', () => {
    const provision = source('console/provision.ts');

    // Sem mapa com que comparar, a fila é tudo o que as extensões pedem — quem decide o que sobe de
    // verdade é a sondagem, e não o registro de quem já foi aplicada uma vez.
    expect(provision).toContain('const probing = options.refreshedStamps === undefined;');
    expect(provision).toContain('deployFunctionsThatChanged');
    expect(provision).toContain('? wantedFunctions');

    // E o que a sonda PULOU conta como satisfeito: ele não subiu porque o projeto já roda este
    // código. Sem isto, a extensão ficaria "pendente" para sempre numa instalação completa.
    expect(provision).toContain('...skippedNow]');
  });

  it('a comparação continua sendo a do firebase, e não uma nossa', () => {
    const module = source('console/functionsUpToDate.ts');

    // Um digest nosso seria um insumo que alguém pode esquecer de incluir, e o preço do esquecimento
    // é pular uma function que MUDOU. O carimbo é lido do projeto, nunca calculado aqui.
    expect(module).not.toContain('createHash');
    expect(module).toContain('listDeployedFunctions');
  });
});
