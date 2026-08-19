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

const push: BackendClaim = {
  pluginId: 'com.microteia.push',
  name: 'Pushes do Tribunal',
  version: '1.0.0',
  backend: {
    functions: ['gmailPush', 'renewGmailWatches'],
    parameters: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
  },
};

const other: BackendClaim = {
  pluginId: 'com.microteia.outra',
  name: 'Outra',
  version: '1.0.0',
  backend: { functions: ['runAction'], parameters: ['OUTRO_TOKEN'] },
};

describe('leitura do arquivo de parâmetros do backend', () => {
  it('ignora comentário, linha vazia e o parâmetro ainda não preenchido', () => {
    const values = parseBackendEnv([
      '# Backend settings for acme',
      '',
      'GOOGLE_CLIENT_ID=123.apps.googleusercontent.com',
      'GOOGLE_CLIENT_SECRET=',
      'GOOGLE_GMAIL_TOPIC=projects/acme/topics/gmail',
    ].join('\n'));

    expect([...values.keys()]).toEqual(['GOOGLE_CLIENT_ID', 'GOOGLE_GMAIL_TOPIC']);
  });

  it('preserva o valor que contém o próprio separador', () => {
    const values = parseBackendEnv('GOOGLE_CLIENT_SECRET=a=b=c\n');
    expect(values.get('GOOGLE_CLIENT_SECRET')).toBe('a=b=c');
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
    const digest = parameterDigest('acme', 'GOOGLE_CLIENT_SECRET', 'segredo-do-escritorio');
    expect(digest).toMatch(/^[0-9a-f]{12}$/);
    expect(digest).not.toContain('segredo');
  });

  it('só calcula digest do que é rastreado e está preenchido', () => {
    const values = new Map([['GOOGLE_CLIENT_ID', 'abc'], ['NAO_RASTREADO', 'x']]);
    const digests = parameterDigests('acme', values, ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET']);
    expect([...digests.keys()]).toEqual(['GOOGLE_CLIENT_ID']);
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
  const digest = (value: string): string => parameterDigest('acme', 'GOOGLE_CLIENT_ID', value);

  it('acusa o parâmetro preenchido depois da instalação', () => {
    const changed = changedParameters(new Map(), new Map([['GOOGLE_CLIENT_ID', digest('novo')]]), ['GOOGLE_CLIENT_ID']);
    expect(changed).toEqual(['GOOGLE_CLIENT_ID']);
  });

  it('acusa o valor trocado e cala quando ele é o mesmo', () => {
    const recorded = new Map([['GOOGLE_CLIENT_ID', digest('antigo')]]);
    expect(changedParameters(recorded, new Map([['GOOGLE_CLIENT_ID', digest('novo')]]), ['GOOGLE_CLIENT_ID']))
      .toEqual(['GOOGLE_CLIENT_ID']);
    expect(changedParameters(recorded, new Map([['GOOGLE_CLIENT_ID', digest('antigo')]]), ['GOOGLE_CLIENT_ID']))
      .toEqual([]);
  });

  it('acusa o parâmetro que esvaziou, porque a function deployada ainda carrega o valor', () => {
    const recorded = new Map([['GOOGLE_CLIENT_ID', digest('antigo')]]);
    expect(changedParameters(recorded, new Map(), ['GOOGLE_CLIENT_ID'])).toEqual(['GOOGLE_CLIENT_ID']);
  });

  it('não acusa nada numa instalação nova em que tudo está vazio', () => {
    expect(changedParameters(new Map(), new Map(), ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'])).toEqual([]);
  });

  it('ignora o parâmetro que extensão nenhuma instalada declara', () => {
    const current = new Map([['SOLTO', 'aaaaaaaaaaaa']]);
    expect(changedParameters(new Map(), current, ['GOOGLE_CLIENT_ID'])).toEqual([]);
  });
});

describe('quais functions carregam um parâmetro', () => {
  it('são as da extensão que o declara, e só ela', () => {
    expect(functionsDeclaringParameters([push, other], ['GOOGLE_CLIENT_SECRET']))
      .toEqual(['gmailPush', 'renewGmailWatches']);
    expect(functionsDeclaringParameters([push, other], ['OUTRO_TOKEN'])).toEqual(['runAction']);
    expect(functionsDeclaringParameters([push, other], [])).toEqual([]);
  });
});

describe('o que fica registrado como aplicado ao fim da execução', () => {
  it('preserva o que já estava aplicado e continua exigido', () => {
    const applied = appliedAfterRun({
      alreadyApplied: ['gmailPush', 'renewGmailWatches'],
      wanted: ['gmailPush', 'renewGmailWatches'],
      deployed: [],
      keptOrphans: [],
    });
    expect(applied).toEqual(['gmailPush', 'renewGmailWatches']);
  });

  it('soma o que subiu agora e o órfão que não foi removido, e descarta o que não é mais exigido', () => {
    const applied = appliedAfterRun({
      alreadyApplied: ['gmailPush', 'antiga'],
      wanted: ['gmailPush', 'renewGmailWatches'],
      deployed: ['renewGmailWatches'],
      keptOrphans: [],
    });
    expect(applied).toEqual(['gmailPush', 'renewGmailWatches']);

    const comOrfa = appliedAfterRun({
      alreadyApplied: ['gmailPush', 'antiga'],
      wanted: ['gmailPush'],
      deployed: [],
      keptOrphans: ['antiga'],
    });
    expect(comOrfa).toEqual(['antiga', 'gmailPush']);
  });
});

describe('avanço da impressão digital depois do deploy', () => {
  const current = new Map([['GOOGLE_CLIENT_SECRET', 'aaaaaaaaaaaa']]);

  it('avança quando todas as functions que carregam o parâmetro subiram', () => {
    const next = appliedParameterState({
      recorded: new Map(),
      current,
      changed: ['GOOGLE_CLIENT_SECRET'],
      failed: [],
      claims: [push],
    });
    expect(next.get('GOOGLE_CLIENT_SECRET')).toBe('aaaaaaaaaaaa');
  });

  it('não avança quando uma delas falhou, para a próxima execução tentar de novo', () => {
    const next = appliedParameterState({
      recorded: new Map([['GOOGLE_CLIENT_SECRET', 'antigo0antigo']]),
      current,
      changed: ['GOOGLE_CLIENT_SECRET'],
      failed: ['renewGmailWatches'],
      claims: [push],
    });
    expect(next.get('GOOGLE_CLIENT_SECRET')).toBe('antigo0antigo');
  });

  it('esquece o parâmetro que esvaziou', () => {
    const next = appliedParameterState({
      recorded: new Map([['GOOGLE_CLIENT_SECRET', 'antigo0antigo']]),
      current: new Map(),
      changed: ['GOOGLE_CLIENT_SECRET'],
      failed: [],
      claims: [push],
    });
    expect(next.has('GOOGLE_CLIENT_SECRET')).toBe(false);
  });

  it('não mexe no que já estava registrado e não mudou', () => {
    const next = appliedParameterState({
      recorded: new Map([['OUTRO_TOKEN', 'bbbbbbbbbbbb']]),
      current,
      changed: ['GOOGLE_CLIENT_SECRET'],
      failed: [],
      claims: [push, other],
    });
    expect(next.get('OUTRO_TOKEN')).toBe('bbbbbbbbbbbb');
  });
});
