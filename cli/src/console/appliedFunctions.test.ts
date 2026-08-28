import { describe, expect, it } from 'vitest';
import {
  appliedAfterRun,
  classifyApplied,
  describeApplied,
  parseAppliedFunctions,
  serializeAppliedFunctions,
} from './appliedFunctions.js';
import type { AppliedFunction } from './appliedFunctions.js';

const entry = (name: string, owner: string | null = null): AppliedFunction => ({ name, owner });

describe('o registro do que já foi deployado', () => {
  it('lê e escreve o par nome@plugin', () => {
    const applied = parseAppliedFunctions('acmeSync@com.acme.crm,acmeRenew@com.acme.crm');
    expect(applied).toEqual([
      { name: 'acmeSync', owner: 'com.acme.crm' },
      { name: 'acmeRenew', owner: 'com.acme.crm' },
    ]);
    expect(serializeAppliedFunctions(applied)).toBe('acmeRenew@com.acme.crm,acmeSync@com.acme.crm');
  });

  /**
   * Uma instalação anterior ao dono gravou só os nomes, e ela continua no ar. Recusá-la esqueceria
   * tudo o que já subiu — e a execução seguinte deployaria de novo, achando que nada foi feito.
   */
  it('lê a lista de nomes soltos que as instalações anteriores gravaram', () => {
    expect(parseAppliedFunctions('acmeSync, acmeRenew')).toEqual([
      { name: 'acmeSync', owner: null },
      { name: 'acmeRenew', owner: null },
    ]);
  });

  it('nada gravado e nada para gravar são o mesmo null', () => {
    expect(parseAppliedFunctions(null)).toEqual([]);
    expect(parseAppliedFunctions('')).toEqual([]);
    expect(serializeAppliedFunctions([])).toBeNull();
  });

  it('o nome repetido é um só, e vale a primeira leitura', () => {
    expect(parseAppliedFunctions('acmeSync@com.acme.crm,acmeSync')).toEqual([
      { name: 'acmeSync', owner: 'com.acme.crm' },
    ]);
  });

  it('sem dono conhecido o relatório mostra só o nome', () => {
    expect(describeApplied(entry('acmeSync', 'com.acme.crm'))).toBe('acmeSync (com.acme.crm)');
    expect(describeApplied(entry('acmeSync'))).toBe('acmeSync');
  });
});

describe('o que ninguém exige mais, e o que fazer com isso', () => {
  const applied = [
    entry('acmeSync', 'com.acme.crm'),
    entry('acmeGone', 'com.acme.crm'),
    entry('auditFlatEntityChange', 'com.acme.crm'),
    entry('brokenOne', 'com.other.ext'),
  ];

  const classified = classifyApplied({
    applied,
    wanted: ['acmeSync'],
    baseline: ['auditFlatEntityChange'],
    unresolved: new Map([['brokenOne', 'com.other.ext']]),
  });

  it('a desinstalada de todos os escritórios é órfã', () => {
    expect(classified.orphans).toEqual([entry('acmeGone', 'com.acme.crm')]);
  });

  /**
   * A function da PLATAFORMA chegou ao registro porque uma extensão reivindicou um nome do kernel. O
   * `deploy` a sobe de qualquer forma, e apagá-la derrubaria um gatilho do produto num escritório que
   * não fez nada.
   */
  it('a function da plataforma nunca é órfã, mesmo reivindicada por uma extensão que saiu', () => {
    expect(classified.preserved).toContainEqual({
      entry: entry('auditFlatEntityChange', 'com.acme.crm'),
      reason: 'baseline',
    });
  });

  /**
   * O caso que fazia `--prune` apagar a function de uma extensão VIVA: um export renomeado em
   * `extensions/<x>/functions/index.ts` recusa a reivindicação, e a recusa a tirava de `wanted`.
   */
  it('a reivindicação que não resolveu é preservada, com quem a pediu', () => {
    expect(classified.preserved).toContainEqual({
      entry: entry('brokenOne', 'com.other.ext'),
      reason: 'unresolved',
      claimant: 'com.other.ext',
    });
    expect(classified.orphans.map((item) => item.name)).not.toContain('brokenOne');
  });

  it('o que continua exigido não entra em nenhuma das duas', () => {
    expect(classified.wanted).toEqual([entry('acmeSync', 'com.acme.crm')]);
  });
});

describe('o que fica registrado como aplicado ao fim da execução', () => {
  const owners = new Map([['integracaoSync', 'com.example.integracao'], ['integracaoRenew', 'com.example.integracao']]);

  it('preserva o que já estava aplicado e continua exigido', () => {
    const applied = appliedAfterRun({
      applied: [entry('integracaoSync', 'com.example.integracao'), entry('integracaoRenew', 'com.example.integracao')],
      wanted: ['integracaoSync', 'integracaoRenew'],
      deployed: [],
      keptOrphans: [],
      preserved: [],
      owners,
    });
    expect(applied.map((item) => item.name)).toEqual(['integracaoRenew', 'integracaoSync']);
  });

  it('soma o que subiu agora e o órfão que não foi removido, e descarta o que não é mais exigido', () => {
    const applied = appliedAfterRun({
      applied: [entry('integracaoSync', 'com.example.integracao'), entry('antiga', 'com.example.antiga')],
      wanted: ['integracaoSync', 'integracaoRenew'],
      deployed: ['integracaoRenew'],
      keptOrphans: [],
      preserved: [],
      owners,
    });
    expect(applied.map((item) => item.name)).toEqual(['integracaoRenew', 'integracaoSync']);

    const comOrfa = appliedAfterRun({
      applied: [entry('integracaoSync', 'com.example.integracao'), entry('antiga', 'com.example.antiga')],
      wanted: ['integracaoSync'],
      deployed: [],
      keptOrphans: [entry('antiga', 'com.example.antiga')],
      preserved: [],
      owners,
    });
    expect(comOrfa.map((item) => item.name)).toEqual(['antiga', 'integracaoSync']);
  });

  /**
   * O preservado tem de SOBREVIVER à gravação. Se ele caísse do registro, a execução seguinte não teria
   * mais o que preservar — e a function ficaria no projeto sem nada que a explicasse.
   */
  it('o preservado continua registrado, com o dono que se sabia dele', () => {
    const applied = appliedAfterRun({
      applied: [entry('brokenOne', 'com.other.ext')],
      wanted: [],
      deployed: [],
      keptOrphans: [],
      preserved: [entry('brokenOne', 'com.other.ext')],
      owners: new Map(),
    });
    expect(applied).toEqual([entry('brokenOne', 'com.other.ext')]);
  });

  /**
   * O dono é reconciliado com quem reivindica AGORA: a function que trocou de extensão entre duas
   * versões fica registrada com a atual, e não com a que a pôs no ar da primeira vez.
   */
  it('o dono registrado é o que reivindica agora', () => {
    const applied = appliedAfterRun({
      applied: [entry('integracaoSync', 'com.antigo.dono')],
      wanted: ['integracaoSync'],
      deployed: [],
      keptOrphans: [],
      preserved: [],
      owners,
    });
    expect(applied).toEqual([entry('integracaoSync', 'com.example.integracao')]);
  });

  it('a function que sobe pela primeira vez nasce com o dono que a pediu', () => {
    const applied = appliedAfterRun({
      applied: [],
      wanted: ['integracaoSync'],
      deployed: ['integracaoSync'],
      keptOrphans: [],
      preserved: [],
      owners,
    });
    expect(applied).toEqual([entry('integracaoSync', 'com.example.integracao')]);
  });
});
