import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { repoRoot } from '../shared/paths.js';
import { isFirstDeploy, parseEnvironment, serializeEnvironment, slug } from './environment.js';
import { EMPTY_BRAND } from './brand.js';
import type { Environment } from './environment.js';
import { REQUIRED_CONFIG_KEYS, runtimeConfigFrom } from './runtimeConfigShape.js';
import { stampedConfigJs } from './workspace.js';

const sample: Environment = {
  project: { name: 'Escritório Ação & Cia: Matriz' },
  environment: { id: 'acao-cia', name: 'Ação & Cia — Produção' },
  firebase: { projectId: 'acme-microteia', region: 'southamerica-east1' },
  kernel: { version: '7.47.0', deployed: '7.46.0' },
  backend: {
    functions: 'integracaoSync,integracaoRenew',
    parameters: 'EXAMPLE_CLIENT_ID:0011223344aa',
    indexes: 'auditLogs:tenantId+,createdAt-;records/group:labels*,at-',
  },
  login: { extensions: 'extensions/dist/sso-acme.json,extensions/dist/marca.json' },
  brand: {
    name: 'Ação Jurídica: Prazos',
    tagline: '@com.acme.brand/tagline',
    description: 'Prazos, intimações e processos — num só lugar.',
    logo: 'brand/logo.png',
    icon: 'brand/icon.svg',
    accent: '#1f6feb',
    url: 'https://prazos.acme.example',
  },
};

describe('arquivo de ambiente', () => {
  it('sobrevive à ida e volta, inclusive com acento e pontuação', () => {
    expect(parseEnvironment(serializeEnvironment(sample))).toEqual(sample);
  });

  it('lê o arquivo recém-criado, com projectId e versão ainda vazios', () => {
    const fresh: Environment = {
      ...sample,
      firebase: { ...sample.firebase, projectId: null },
      kernel: { version: null, deployed: null },
      backend: { functions: null, parameters: null, indexes: null },
      login: { extensions: null },
      brand: EMPTY_BRAND,
    };
    expect(parseEnvironment(serializeEnvironment(fresh))).toEqual(fresh);
  });

  it('recusa sintaxe que não entende em vez de adivinhar', () => {
    expect(() => parseEnvironment('project:\n  name: [a, b]\nlixo aqui\n')).toThrow(/line 3/);
  });

  it('acusa o campo que falta, nomeando-o', () => {
    expect(() => parseEnvironment('project:\n  name: x\n')).toThrow(/environment\.id/);
  });

  /**
   * O `unpack` grava `version` antes do primeiro deploy. Perguntar por ele fazia a primeira instalação
   * subir sem `--force`: sem política de limpeza e com os gatilhos de `retry: true` recusados.
   */
  it('a primeira instalação é a que nunca publicou, mesmo com o pacote já desempacotado', () => {
    expect(isFirstDeploy({ ...sample, kernel: { version: '9.266.1', deployed: null } })).toBe(true);
    expect(isFirstDeploy({ ...sample, kernel: { version: '9.266.1', deployed: '9.266.1' } })).toBe(false);
    expect(isFirstDeploy({ ...sample, kernel: { version: '9.267.0', deployed: '9.266.1' } })).toBe(false);
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
