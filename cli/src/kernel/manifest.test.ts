import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readdirSync } from 'node:fs';
import {
  MANUAL_PREREQUISITES,
  callableFunctionNames,
  compareVersions,
  declaredParametersIn,
  exportedFunctionNames,
  parseKernelVersion,
} from './manifest.js';
import { repoRoot } from '../shared/paths.js';

const read = (relative: string): string => readFileSync(join(repoRoot, relative), 'utf8');

/**
 * O manifesto declara quais Cloud Functions a instalação tem, e o Console deploya uma a uma a partir
 * dessa lista. Se ela divergir do que `functions/src/index.ts` exporta, uma function nova
 * simplesmente não sobe na casa do cliente — o mesmo defeito que `scripts/deployLists.test.ts` já
 * pegou duas vezes do lado de cá, com `runAction` e `recomputeAggregatesOnEntityChange`.
 */
describe('manifesto do kernel', () => {
  it('enxerga as mesmas functions que a lista guardada do deploy individual', () => {
    const fromIndex = new Set(exportedFunctionNames(read('functions/src/index.ts')));

    const block = read('scripts/deploy-functions-individually.cjs')
      .match(/const ALL_FUNCTIONS = \[([\s\S]*?)\];/);
    if (!block) throw new Error('ALL_FUNCTIONS não encontrado');
    const guarded = [...block[1].matchAll(/'([^']+)'/g)].map((match) => match[1]);

    const missing = guarded.filter((name) => !fromIndex.has(name));
    expect(missing, `functions que o manifesto não veria: ${missing.join(', ')}`).toEqual([]);
    expect(fromIndex.size).toBe(guarded.length);
  });

  it('encontra as functions (guarda contra o parser silenciosamente vazio)', () => {
    expect(exportedFunctionNames(read('functions/src/index.ts')).length).toBeGreaterThan(20);
  });

  it('lê a versão do contrato do kernel', () => {
    const version = parseKernelVersion(read('src/domain/schema/plugin/kernelVersion.ts'));
    expect(version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('falha em vez de inventar uma versão quando a constante some', () => {
    expect(() => parseKernelVersion('export const OUTRA_COISA = 1;')).toThrow();
  });
});

/**
 * As callables são as únicas functions que podem ser verificadas de fora, e as únicas em que a
 * permissão de invocação pública importa. Se a lista do manifesto ficar vazia por um parser que
 * deixou de casar, a verificação de alcance passa a "aprovar" toda instalação sem olhar nada.
 */
describe('pré-requisitos manuais', () => {
  /**
   * O que está aqui é o que TODA instalação precisa, sem exceção — e é por isso que a lista é fechada.
   *
   * O passo do Gmail já esteve nela. Ele saiu para o `manifest.backend.prerequisites` da extensão que o
   * exige, e depois saiu deste repositório junto com ela. Quem instala não tem o `ARCHITECTURE.md`, e um
   * pré-requisito no lugar errado é a única explicação de por que algo não funciona chegando à pessoa
   * errada: aqui ele apareceria para quem nunca vai receber intimação por e-mail.
   */
  it('nenhum pré-requisito do kernel é de um caso de uso particular', () => {
    const ids = MANUAL_PREREQUISITES.map((prerequisite) => prerequisite.id);
    expect(ids).not.toContain('gmail-integration');
    // A conferência é sobre o TEXTO também: um passo genérico que citasse uma credencial de terceiro
    // seria o mesmo defeito com outro nome.
    for (const prerequisite of MANUAL_PREREQUISITES) {
      expect(`${prerequisite.title} ${prerequisite.detail}`, prerequisite.id).not.toMatch(/GOOGLE_|Gmail/);
    }
  });

  it('o que sobrou é do kernel de verdade — o que toda instalação precisa', () => {
    expect(MANUAL_PREREQUISITES.map((prerequisite) => prerequisite.id)).toEqual([
      'billing', 'app-engine', 'firestore-location', 'storage-bucket', 'auth-provider',
      'functions-invoker', 'audit-ttl',
    ]);
  });
});

describe('callables no manifesto', () => {
  const sources = (): string[] => {
    const found: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) walk(path);
        else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
          found.push(readFileSync(path, 'utf8'));
        }
      }
    };
    walk(join(repoRoot, 'functions/src'));
    return found;
  };

  const callables = (): string[] =>
    [...new Set(sources().flatMap((source) => callableFunctionNames(source)))];

  // A lista é "o que o mundo de fora chama", e não "o que é `onCall`". O gatilho fica de fora porque
  // ninguém o alcança por URL; o `onRequest` entra porque a invocação pública decide se ele responde,
  // exatamente como decide para uma callable.
  it('distingue o que se chama de fora do que só um gatilho acorda', () => {
    const parsed = callableFunctionNames(
      "export const chamada = onCall({ region: 'x' }, () => 1);\n"
      + "export const gatilho = onDocumentWritten('a/{b}', () => 2);\n"
      + "export const web = onRequest(() => 3);\n"
      + "export const agendada = onSchedule('every day 03:00', () => 4);\n",
    );
    expect(parsed).toEqual(['chamada', 'web']);
  });

  it('o endpoint HTTP do agente entra na conferência de alcance', () => {
    expect(callables()).toContain('agentMcp');
  });

  it('encontra as callables reais do backend', () => {
    const names = callables();
    expect(names).toContain('getUserInfo');
    expect(names).toContain('runWorkflow');
    expect(names.length).toBeGreaterThan(10);
  });

  it('toda callable que o pacote vai verificar está entre as functions exportadas', () => {
    const exported = new Set(exportedFunctionNames(read('functions/src/index.ts')));
    const verified = callables().filter((name) => exported.has(name));
    expect(verified.length).toBeGreaterThan(10);
  });
});

/**
 * O `firebase-functions` valida os `defineString` GLOBALMENTE: um sem valor e sem default recusa o
 * deploy de TODAS as functions. Um `GOOGLE_GMAIL_TOPIC` ausente derrubou `callAIProxy` — duas coisas
 * que não se parecem. É por isso que a lista é derivada do código e não copiada de um template.
 */
describe('parâmetros do backend', () => {
  const functionSources = (): string[] => {
    const found: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) walk(path);
        else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
          found.push(readFileSync(path, 'utf8'));
        }
      }
    };
    walk(join(repoRoot, 'functions/src'));
    return found;
  };

  const declared = (): { name: string; required: boolean }[] => {
    const found = new Map<string, { name: string; required: boolean }>();
    for (const source of functionSources()) {
      for (const parameter of declaredParametersIn(source)) {
        if (!found.has(parameter.name) || parameter.required) found.set(parameter.name, parameter);
      }
    }
    return [...found.values()];
  };

  it('distingue quem tem default de quem não tem', () => {
    const parsed = declaredParametersIn(
      "defineString('SEM_DEFAULT');\ndefineString('COM_DEFAULT', { default: 'x' });",
    );
    expect(parsed).toEqual([
      { name: 'SEM_DEFAULT', required: true },
      { name: 'COM_DEFAULT', required: false },
    ]);
  });

  /**
   * O kernel não declara parâmetro nenhum, e isso é o estado CERTO — não uma lacuna. Os quatro que
   * existiam eram do Gmail, portanto da extensão de Pushes do Tribunal, e saíram junto com ela.
   *
   * O caso fica aqui em vez de ser apagado porque ele é a fronteira: um parâmetro que reaparecer neste
   * repositório é uma credencial que TODA instalação passa a ter de preencher, inclusive quem não usa a
   * feature. Se for mesmo do kernel, atualize esta lista e o `.env.example` na mesma alteração.
   */
  it('o kernel não declara parâmetro de backend — os que existiam eram de extensão', () => {
    expect(declared()).toEqual([]);
  });

  it('o .env.example do repositório cobre todo parâmetro obrigatório', () => {
    const template = readFileSync(join(repoRoot, 'functions/.env.example'), 'utf8');
    const documented = new Set(
      [...template.matchAll(/^([A-Z0-9_]+)=/gm)].map((match) => match[1]),
    );
    const missing = declared()
      .filter((parameter) => parameter.required && !documented.has(parameter.name))
      .map((parameter) => parameter.name);

    expect(missing, `ausentes em functions/.env.example: ${missing.join(', ')}`).toEqual([]);
  });
});

/**
 * É esta comparação que decide se um pacote pode ser instalado pelo Console que o cliente tem. Errar
 * o sinal deixaria um Console velho instalar um pacote que ele não sabe montar — e a falha
 * apareceria como um deploy pela metade, não como uma recusa.
 */
describe('comparação de versão do Console', () => {
  it('ordena por major, minor e patch', () => {
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
    expect(compareVersions('2.0.0', '1.9.9')).toBeGreaterThan(0);
    expect(compareVersions('1.2.0', '1.10.0')).toBeLessThan(0);
    expect(compareVersions('1.0.1', '1.0.0')).toBeGreaterThan(0);
  });

  it('trata componente ausente como zero', () => {
    expect(compareVersions('1', '1.0.0')).toBe(0);
    expect(compareVersions('1.1', '1.0.9')).toBeGreaterThan(0);
  });
});
