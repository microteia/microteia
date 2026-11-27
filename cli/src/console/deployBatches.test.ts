import { beforeEach, describe, expect, it, vi } from 'vitest';

const calls: string[][] = [];
let respond: (args: string[]) => { code: number; stdout: string; stderr: string } = () => ({ code: 0, stdout: '', stderr: '' });

vi.mock('../shared/run.js', () => ({
  capture: async (_command: string, args: string[]) => {
    calls.push(args);
    return respond(args);
  },
  sleep: async () => undefined,
}));

vi.mock('../shared/ui.js', () => ({
  blank: () => undefined,
  failure: () => undefined,
  info: () => undefined,
  pending: () => undefined,
  success: () => undefined,
}));

const {
  batchesOf,
  deployFunctionList,
  succeededIn,
  withoutFunctionsPredeploy,
} = await import('./deployFunctions.js');

const options = {
  projectId: 'acme',
  cwd: '/install',
  delaySeconds: 0,
  force: false,
  standingCopies: new Set<string>(),
  config: '/install/firebase.functions-deploy.json',
};

/** O que o `firebase` escreve ao terminar bem cada function (`release/fabricator.js`). */
const successLine = (name: string, op = 'update'): string =>
  `\u001b[1m\u001b[32mfunctions[${name}(southamerica-east1)]\u001b[39m\u001b[22m Successful ${op} operation.`;

const onlyOf = (args: string[]): string[] =>
  args[args.indexOf('--only') + 1].split(',').map((entry) => entry.replace('functions:', ''));

beforeEach(() => {
  calls.length = 0;
  respond = () => ({ code: 0, stdout: '', stderr: '' });
});

describe('a leitura de quem subiu num lote que terminou em erro', () => {
  it('lê a linha de sucesso do firebase, atravessando a cor do terminal', () => {
    const output = [successLine('a'), successLine('b', 'create'), 'Error: failed to update function c'].join('\n');
    expect(succeededIn(output, ['a', 'b', 'c'])).toEqual(['a', 'b']);
  });

  it('não conta function que não estava no lote', () => {
    expect(succeededIn(successLine('outra'), ['a'])).toEqual([]);
  });

  it('não confunde a falha com sucesso', () => {
    expect(succeededIn('functions[a(southamerica-east1)]: Deployment error.', ['a'])).toEqual([]);
  });
});

describe('a divisão em lotes', () => {
  it('corta na ordem, com o resto no último', () => {
    expect(batchesOf(['a', 'b', 'c', 'd', 'e'], 2)).toEqual([['a', 'b'], ['c', 'd'], ['e']]);
  });

  it('trata tamanho inválido como uma a uma', () => {
    expect(batchesOf(['a', 'b'], 0)).toEqual([['a'], ['b']]);
    expect(batchesOf(['a', 'b'], Number.NaN)).toEqual([['a'], ['b']]);
  });
});

describe('o firebase.json do deploy de functions', () => {
  it('tira o predeploy e mantém o resto', () => {
    const original = JSON.stringify({
      functions: { source: 'functions', ignore: ['node_modules'], predeploy: ['npm run build'] },
      hosting: { public: 'dist' },
    });
    expect(JSON.parse(withoutFunctionsPredeploy(original))).toEqual({
      functions: { source: 'functions', ignore: ['node_modules'] },
      hosting: { public: 'dist' },
    });
  });

  it('serve a forma de lista, com vários codebases', () => {
    const original = JSON.stringify({ functions: [{ source: 'a', predeploy: ['x'] }, { source: 'b' }] });
    expect(JSON.parse(withoutFunctionsPredeploy(original))).toEqual({ functions: [{ source: 'a' }, { source: 'b' }] });
  });
});

describe('o deploy em lotes', () => {
  it('sobe o lote num comando só, com a configuração sem predeploy', async () => {
    const report = await deployFunctionList(['a', 'b', 'c'], { ...options, batchSize: 3 });

    expect(calls).toHaveLength(1);
    expect(onlyOf(calls[0])).toEqual(['a', 'b', 'c']);
    expect(calls[0]).toContain('--config');
    expect(report.deployed).toEqual(['a', 'b', 'c']);
    expect(report.failed).toEqual([]);
  });

  it('tenta sozinha só a function que o lote não subiu', async () => {
    respond = (args) => {
      const names = onlyOf(args);
      if (names.length > 1) {
        return { code: 1, stdout: [successLine('a'), successLine('c'), 'Error: HTTP Error: 429, quota'].join('\n'), stderr: '' };
      }
      return { code: 0, stdout: successLine(names[0]), stderr: '' };
    };

    const report = await deployFunctionList(['a', 'b', 'c'], { ...options, batchSize: 3 });

    expect(calls.map(onlyOf)).toEqual([['a', 'b', 'c'], ['b']]);
    expect(report.deployed.sort()).toEqual(['a', 'b', 'c']);
  });

  it('um lote recusado por inteiro cai no caminho de uma a uma, que confirma a política de repetição', async () => {
    const refusal = 'Error: Pass the --force option to deploy functions with a failure policy';
    respond = (args) => {
      const names = onlyOf(args);
      if (names.length > 1) return { code: 1, stdout: refusal, stderr: '' };
      if (names[0] === 'b' && !args.includes('--force')) return { code: 1, stdout: refusal, stderr: '' };
      return { code: 0, stdout: successLine(names[0]), stderr: '' };
    };

    const report = await deployFunctionList(['a', 'b'], { ...options, batchSize: 2 });

    expect(calls.map((args) => [...onlyOf(args), args.includes('--force') ? 'force' : ''])).toEqual([
      ['a', 'b', ''],
      ['a', ''],
      ['b', ''],
      ['b', 'force'],
    ]);
    expect(report.deployed).toEqual(['a', 'b']);
  });

  it('com lote de um, é o deploy uma a uma de sempre', async () => {
    await deployFunctionList(['a', 'b'], { ...options, batchSize: 1 });
    expect(calls.map(onlyOf)).toEqual([['a'], ['b']]);
  });
});
