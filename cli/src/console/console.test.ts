import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { repoRoot } from '../shared/paths.js';
import { parseEnvironment, serializeEnvironment, slug } from './environment.js';
import type { Environment } from './environment.js';
import { REQUIRED_CONFIG_KEYS, runtimeConfigFrom } from './runtimeConfigShape.js';
import { stampedConfigJs } from './workspace.js';

const sample: Environment = {
  project: { name: 'Escritório Ação & Cia: Matriz' },
  environment: { id: 'acao-cia', name: 'Ação & Cia — Produção' },
  firebase: { projectId: 'acme-microteia', region: 'southamerica-east1' },
  kernel: { version: '7.47.0' },
  backend: { functions: 'gmailPush,renewGmailWatches' },
};

describe('arquivo de ambiente', () => {
  it('sobrevive à ida e volta, inclusive com acento e pontuação', () => {
    expect(parseEnvironment(serializeEnvironment(sample))).toEqual(sample);
  });

  it('lê o arquivo recém-criado, com projectId e versão ainda vazios', () => {
    const fresh: Environment = {
      ...sample,
      firebase: { ...sample.firebase, projectId: null },
      kernel: { version: null },
      backend: { functions: null },
    };
    expect(parseEnvironment(serializeEnvironment(fresh))).toEqual(fresh);
  });

  it('recusa sintaxe que não entende em vez de adivinhar', () => {
    expect(() => parseEnvironment('project:\n  name: [a, b]\nlixo aqui\n')).toThrow(/line 3/);
  });

  it('acusa o campo que falta, nomeando-o', () => {
    expect(() => parseEnvironment('project:\n  name: x\n')).toThrow(/environment\.id/);
  });

  it('deriva um id utilizável de um nome com acento e espaço', () => {
    expect(slug('Ação & Cia — Matriz')).toBe('acao-cia-matriz');
  });
});

describe('contrato de configuração entre o Console e o kernel', () => {
  /**
   * O Console declara a forma da configuração de novo, porque precisa poder ser publicado sem o
   * `src/` do kernel. Se as duas listas se separarem, o Console carimba um arquivo que o kernel
   * rejeita no boot — e isso só aparece quando alguém abre a aplicação instalada.
   */
  it('exige exatamente as mesmas chaves que o kernel exige', () => {
    const source = readFileSync(
      join(repoRoot, 'src/infrastructure/firebase/runtimeConfig.ts'),
      'utf8',
    );
    const block = source.match(/REQUIRED_CONFIG_KEYS = \[([\s\S]*?)\]/);
    if (!block) throw new Error('REQUIRED_CONFIG_KEYS não encontrado no kernel');

    const kernelKeys = [...block[1].matchAll(/'([^']+)'/g)].map((match) => match[1]);
    expect([...REQUIRED_CONFIG_KEYS]).toEqual(kernelKeys);
  });

  it('o global carimbado é o mesmo que o kernel lê', () => {
    const source = readFileSync(
      join(repoRoot, 'src/infrastructure/firebase/runtimeConfig.ts'),
      'utf8',
    );
    expect(source).toContain('__MICROTEIA_CONFIG__');
    expect(stampedConfigJs({
      apiKey: 'k',
      authDomain: 'd',
      projectId: 'p',
      storageBucket: 'b',
      messagingSenderId: 'm',
      appId: 'a',
    })).toContain('window.__MICROTEIA_CONFIG__ =');
  });

  it('recusa uma configuração pela metade, nomeando o que falta', () => {
    expect(() => runtimeConfigFrom({ apiKey: 'k', projectId: 'p' }, 'southamerica-east1'))
      .toThrow(/authDomain/);
  });

  it('mantém measurementId quando existe e o omite quando não', () => {
    const complete = {
      apiKey: 'k', authDomain: 'd', projectId: 'p', storageBucket: 'b',
      messagingSenderId: 'm', appId: 'a', measurementId: 'G-1',
    };
    expect(runtimeConfigFrom(complete, 'r').measurementId).toBe('G-1');

    const withoutAnalytics = {
      apiKey: 'k', authDomain: 'd', projectId: 'p', storageBucket: 'b',
      messagingSenderId: 'm', appId: 'a',
    };
    expect(runtimeConfigFrom(withoutAnalytics, 'r')).not.toHaveProperty('measurementId');
  });
});
