import { describe, expect, it } from 'vitest';
import type { BackendClaim } from '../kernel/backendShape.js';
import {
  changedParameters,
  functionsDeclaringParameters,
  parameterDigest,
  parameterDigests,
  parseBackendEnv,
  parseParameterState,
  serializeParameterState,
} from './backendParameters.js';
import { appliedAfterRun, appliedParameterState } from './provision.js';

/**
 * Uma extensão que exige function E parâmetro — a forma que este mecanismo existe para servir. Era a de
 * Pushes do Tribunal, com as cinco functions do Gmail; a fixture é sintética desde que ela passou a ser
 * mantida fora deste repositório, e é melhor assim: o que se testa aqui é a impressão digital do
 * parâmetro, não o nome de quem o pede.
 */
const claimant: BackendClaim = {
  pluginId: 'com.example.integracao',
  name: 'Integração de exemplo',
  version: '1.0.0',
  backend: {
    functions: ['integracaoSync', 'integracaoRenew'],
    parameters: ['EXAMPLE_CLIENT_ID', 'EXAMPLE_CLIENT_SECRET'],
  },
};

const other: BackendClaim = {
  pluginId: 'com.example.outra',
  name: 'Outra',
  version: '1.0.0',
  backend: { functions: ['runAction'], parameters: ['OUTRO_TOKEN'] },
};

describe('leitura do arquivo de parâmetros do backend', () => {
  it('ignora comentário, linha vazia e o parâmetro ainda não preenchido', () => {
    const values = parseBackendEnv([
      '# Backend settings for acme',
      '',
      'EXAMPLE_CLIENT_ID=123.apps.googleusercontent.com',
      'EXAMPLE_CLIENT_SECRET=',
      'EXAMPLE_TOPIC=projects/acme/topics/exemplo',
    ].join('\n'));

    expect([...values.keys()]).toEqual(['EXAMPLE_CLIENT_ID', 'EXAMPLE_TOPIC']);
  });

  it('preserva o valor que contém o próprio separador', () => {
    const values = parseBackendEnv('EXAMPLE_CLIENT_SECRET=a=b=c\n');
    expect(values.get('EXAMPLE_CLIENT_SECRET')).toBe('a=b=c');
  });
});

describe('impressão digital de um parâmetro', () => {
  it('é estável para o mesmo valor e muda quando o valor muda', () => {
    expect(parameterDigest('acme', 'X', 'um')).toBe(parameterDigest('acme', 'X', 'um'));
    expect(parameterDigest('acme', 'X', 'um')).not.toBe(parameterDigest('acme', 'X', 'dois'));
  });

  it('é salgada com o projeto e com o nome, para não ser consulta de dicionário', () => {
    expect(parameterDigest('acme', 'X', 'um')).not.toBe(parameterDigest('outro', 'X', 'um'));
    expect(parameterDigest('acme', 'X', 'um')).not.toBe(parameterDigest('acme', 'Y', 'um'));
  });

  it('não guarda o valor em lugar nenhum do que é gravado', () => {
    const digest = parameterDigest('acme', 'EXAMPLE_CLIENT_SECRET', 'segredo-do-escritorio');
    expect(digest).toMatch(/^[0-9a-f]{12}$/);
    expect(digest).not.toContain('segredo');
  });

  it('só calcula digest do que é rastreado e está preenchido', () => {
    const values = new Map([['EXAMPLE_CLIENT_ID', 'abc'], ['NAO_RASTREADO', 'x']]);
    const digests = parameterDigests('acme', values, ['EXAMPLE_CLIENT_ID', 'EXAMPLE_CLIENT_SECRET']);
    expect([...digests.keys()]).toEqual(['EXAMPLE_CLIENT_ID']);
  });
});

describe('estado dos parâmetros no arquivo de instalação', () => {
  it('sobrevive à ida e volta, em ordem estável', () => {
    const state = new Map([['B_PARAM', 'ff00ff00ff00'], ['A_PARAM', '0011223344aa']]);
    const raw = serializeParameterState(state);
    expect(raw).toBe('A_PARAM:0011223344aa,B_PARAM:ff00ff00ff00');
    expect(parseParameterState(raw)).toEqual(new Map([
      ['A_PARAM', '0011223344aa'],
      ['B_PARAM', 'ff00ff00ff00'],
    ]));
  });

  it('trata a ausência do campo como nenhum parâmetro aplicado', () => {
    expect(parseParameterState(null)).toEqual(new Map());
    expect(serializeParameterState(new Map())).toBeNull();
  });
});

describe('o que mudou desde a última aplicação', () => {
  const digest = (value: string): string => parameterDigest('acme', 'EXAMPLE_CLIENT_ID', value);

  it('acusa o parâmetro preenchido depois da instalação', () => {
    const changed = changedParameters(new Map(), new Map([['EXAMPLE_CLIENT_ID', digest('novo')]]), ['EXAMPLE_CLIENT_ID']);
    expect(changed).toEqual(['EXAMPLE_CLIENT_ID']);
  });

  it('acusa o valor trocado e cala quando ele é o mesmo', () => {
    const recorded = new Map([['EXAMPLE_CLIENT_ID', digest('antigo')]]);
    expect(changedParameters(recorded, new Map([['EXAMPLE_CLIENT_ID', digest('novo')]]), ['EXAMPLE_CLIENT_ID']))
      .toEqual(['EXAMPLE_CLIENT_ID']);
    expect(changedParameters(recorded, new Map([['EXAMPLE_CLIENT_ID', digest('antigo')]]), ['EXAMPLE_CLIENT_ID']))
      .toEqual([]);
  });

  it('acusa o parâmetro que esvaziou, porque a function deployada ainda carrega o valor', () => {
    const recorded = new Map([['EXAMPLE_CLIENT_ID', digest('antigo')]]);
    expect(changedParameters(recorded, new Map(), ['EXAMPLE_CLIENT_ID'])).toEqual(['EXAMPLE_CLIENT_ID']);
  });

  it('não acusa nada numa instalação nova em que tudo está vazio', () => {
    expect(changedParameters(new Map(), new Map(), ['EXAMPLE_CLIENT_ID', 'EXAMPLE_CLIENT_SECRET'])).toEqual([]);
  });

  it('ignora o parâmetro que extensão nenhuma instalada declara', () => {
    const current = new Map([['SOLTO', 'aaaaaaaaaaaa']]);
    expect(changedParameters(new Map(), current, ['EXAMPLE_CLIENT_ID'])).toEqual([]);
  });
});

describe('quais functions carregam um parâmetro', () => {
  it('são as da extensão que o declara, e só ela', () => {
    expect(functionsDeclaringParameters([claimant, other], ['EXAMPLE_CLIENT_SECRET']))
      .toEqual(['integracaoRenew', 'integracaoSync']);
    expect(functionsDeclaringParameters([claimant, other], ['OUTRO_TOKEN'])).toEqual(['runAction']);
    expect(functionsDeclaringParameters([claimant, other], [])).toEqual([]);
  });
});

describe('o que fica registrado como aplicado ao fim da execução', () => {
  it('preserva o que já estava aplicado e continua exigido', () => {
    const applied = appliedAfterRun({
      alreadyApplied: ['integracaoSync', 'integracaoRenew'],
      wanted: ['integracaoSync', 'integracaoRenew'],
      deployed: [],
      keptOrphans: [],
    });
    expect(applied).toEqual(['integracaoRenew', 'integracaoSync']);
  });

  it('soma o que subiu agora e o órfão que não foi removido, e descarta o que não é mais exigido', () => {
    const applied = appliedAfterRun({
      alreadyApplied: ['integracaoSync', 'antiga'],
      wanted: ['integracaoSync', 'integracaoRenew'],
      deployed: ['integracaoRenew'],
      keptOrphans: [],
    });
    expect(applied).toEqual(['integracaoRenew', 'integracaoSync']);

    const comOrfa = appliedAfterRun({
      alreadyApplied: ['integracaoSync', 'antiga'],
      wanted: ['integracaoSync'],
      deployed: [],
      keptOrphans: ['antiga'],
    });
    expect(comOrfa).toEqual(['antiga', 'integracaoSync']);
  });
});

describe('avanço da impressão digital depois do deploy', () => {
  const current = new Map([['EXAMPLE_CLIENT_SECRET', 'aaaaaaaaaaaa']]);

  it('avança quando todas as functions que carregam o parâmetro subiram', () => {
    const next = appliedParameterState({
      recorded: new Map(),
      current,
      changed: ['EXAMPLE_CLIENT_SECRET'],
      failed: [],
      claims: [claimant],
    });
    expect(next.get('EXAMPLE_CLIENT_SECRET')).toBe('aaaaaaaaaaaa');
  });

  it('não avança quando uma delas falhou, para a próxima execução tentar de novo', () => {
    const next = appliedParameterState({
      recorded: new Map([['EXAMPLE_CLIENT_SECRET', 'antigo0antigo']]),
      current,
      changed: ['EXAMPLE_CLIENT_SECRET'],
      failed: ['integracaoRenew'],
      claims: [claimant],
    });
    expect(next.get('EXAMPLE_CLIENT_SECRET')).toBe('antigo0antigo');
  });

  it('esquece o parâmetro que esvaziou', () => {
    const next = appliedParameterState({
      recorded: new Map([['EXAMPLE_CLIENT_SECRET', 'antigo0antigo']]),
      current: new Map(),
      changed: ['EXAMPLE_CLIENT_SECRET'],
      failed: [],
      claims: [claimant],
    });
    expect(next.has('EXAMPLE_CLIENT_SECRET')).toBe(false);
  });

  it('não mexe no que já estava registrado e não mudou', () => {
    const next = appliedParameterState({
      recorded: new Map([['OUTRO_TOKEN', 'bbbbbbbbbbbb']]),
      current,
      changed: ['EXAMPLE_CLIENT_SECRET'],
      failed: [],
      claims: [claimant, other],
    });
    expect(next.get('OUTRO_TOKEN')).toBe('bbbbbbbbbbbb');
  });
});
