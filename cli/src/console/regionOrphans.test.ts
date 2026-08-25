import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { repoRoot } from '../shared/paths.js';
import { deleteCommand, regionOrphans } from './regionOrphans.js';
import type { DeployedFunction } from './regionOrphans.js';

/**
 * O projeto do escritório depois de o pacote trocar `us-central1` por `southamerica-east1`: o
 * Firebase criou a function na região nova e deixou a antiga onde estava. É esse par que faz o
 * `firebase deploy --only functions:<nome>` recusar — o filtro `--only` casa por id e ignora região,
 * então a cópia velha entra no plano como algo a apagar, e apagar exige uma confirmação que o deploy
 * não tem como dar.
 */
const deployed: DeployedFunction[] = [
  { name: 'callAIProxy', region: 'us-central1' },
  { name: 'callAIProxy', region: 'southamerica-east1' },
  { name: 'auditFlatEntityChange', region: 'us-central1' },
  { name: 'auditFlatEntityChange', region: 'southamerica-east1' },
  { name: 'getUserInfo', region: 'southamerica-east1' },
];

describe('a cópia deixada numa região abandonada', () => {
  it('acusa só o que está fora da região do pacote', () => {
    const wanted = ['callAIProxy', 'auditFlatEntityChange', 'getUserInfo'];

    expect(regionOrphans(deployed, wanted, 'southamerica-east1')).toEqual([
      { name: 'auditFlatEntityChange', region: 'us-central1' },
      { name: 'callAIProxy', region: 'us-central1' },
    ]);
  });

  /**
   * O critério é o conjunto que ESTE deploy vai tocar, e não "região diferente da esperada": o
   * escritório pode ter escrito uma function própria noutra região de propósito, e acusá-la seria
   * oferecer apagar o que ninguém pediu para apagar.
   */
  it('ignora a function que este deploy não vai tocar, mesmo fora da região', () => {
    const withOffice = [...deployed, { name: 'officeOwnJob', region: 'europe-west1' }];

    expect(regionOrphans(withOffice, ['callAIProxy'], 'southamerica-east1'))
      .toEqual([{ name: 'callAIProxy', region: 'us-central1' }]);
  });

  it('não acusa nada quando o projeto já está inteiro na região certa', () => {
    const settled: DeployedFunction[] = [
      { name: 'callAIProxy', region: 'southamerica-east1' },
      { name: 'getUserInfo', region: 'southamerica-east1' },
    ];

    expect(regionOrphans(settled, ['callAIProxy', 'getUserInfo'], 'southamerica-east1')).toEqual([]);
  });

  it('o comando que ele imprime apaga uma região só, sem perguntar', () => {
    expect(deleteCommand('acme-microteia', { name: 'callAIProxy', region: 'us-central1' }))
      .toBe('firebase functions:delete callAIProxy --region us-central1'
        + ' --project acme-microteia --force');
  });
});

/**
 * O teste lê a fonte porque o que ele guarda é a ORDEM: verificar depois de deployar não serve para
 * nada — o deploy já falhou, uma function de cada vez, com quarenta segundos cada. E o efeito real
 * só apareceria contra um projeto Firebase com uma função duplicada em duas regiões.
 */
describe('a verificação acontece antes de deployar', () => {
  const source = (path: string): string => readFileSync(join(repoRoot, 'cli/src', path), 'utf8');

  it('o deploy limpa a região antiga antes de subir qualquer function', () => {
    const deploy = source('console/deploy.ts');
    const cleared = deploy.indexOf('clearRegionOrphans(');
    const deployed_ = deploy.indexOf('deployFunctionsThatChanged(own');

    expect(cleared).toBeGreaterThan(-1);
    expect(cleared).toBeLessThan(deployed_);
  });

  it('o provision faz o mesmo, porque a extensão também muda de região', () => {
    const provision = source('console/provision.ts');
    const cleared = provision.indexOf('clearRegionOrphans(');
    const deployed_ = provision.indexOf('deployFunctionsOneByOne(toDeploy');

    expect(cleared).toBeGreaterThan(-1);
    expect(cleared).toBeLessThan(deployed_);
  });
});
