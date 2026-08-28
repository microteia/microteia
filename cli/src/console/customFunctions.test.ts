import { describe, expect, it, beforeEach } from 'vitest';
import { mkdtemp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  dependencyPlan,
  exportedNames,
  findFunctionSources,
  functionProblems,
  gatherCustomFunctions,
  readOfficeFunctions,
} from './customFunctions.js';

/**
 * As Cloud Functions do escritório vêm de dois lugares que respondem a duas perguntas: a function é
 * daquela extensão (`extensions/<plugin>/functions/`) ou é comum a várias (`functions/`)? Os dois ficam
 * FORA de `.microteia/`, que o `unpack` apaga por inteiro.
 *
 * O risco que estes casos guardam é o de substituição silenciosa: o `index.js` do pacote espalha o
 * customizado DEPOIS do kernel, então um nome repetido troca a implementação sem erro nenhum. Um gatilho
 * do kernel substituído não falha — ele simplesmente deixa de acontecer.
 */
const KERNEL = ['onWorkflowEventCreated', 'runScript', 'runAction'];

let root: string;

const writeFunctions = async (relative: string, source: string): Promise<void> => {
  await mkdir(join(root, relative), { recursive: true });
  await writeFile(join(root, relative, 'index.ts'), source);
};

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'microteia-fn-'));
});

describe('os nomes que um módulo de entrada exporta', () => {
  it('reconhece a declaração no lugar, que é como se escreve uma function', () => {
    expect(exportedNames("export const helloOffice = onCall({}, () => ({ ok: true }));"))
      .toEqual(['helloOffice']);
  });

  it('reconhece a reexportação, que é como se organiza um diretório', () => {
    expect(exportedNames("export { alpha, beta } from './handlers';")).toEqual(['alpha', 'beta']);
  });

  it('lê o nome final de um alias, que é o que vai ser deployado', () => {
    expect(exportedNames("export { internalName as publicName };")).toEqual(['publicName']);
  });

  it('ignora o default, que não é uma function deployável', () => {
    expect(exportedNames('export default {};')).toEqual([]);
  });
});

describe('de onde as functions do escritório vêm', () => {
  it('acha as comuns e as de cada extensão, e nomeia cada origem', async () => {
    await writeFunctions('functions', 'export const shared = 1;');
    await writeFunctions('extensions/vendas/functions', 'export const vendasHook = 1;');
    await writeFunctions('extensions/rh/functions', 'export const rhHook = 1;');

    const sources = await findFunctionSources(root);
    expect(sources.map((source) => source.label)).toEqual([
      'functions',
      'extensions/rh/functions',
      'extensions/vendas/functions',
    ]);
    expect(sources.map((source) => source.slug)).toEqual(['shared', 'rh', 'vendas']);
  });

  it('não encontra nada numa instalação que não escreveu function nenhuma', async () => {
    expect(await findFunctionSources(root)).toEqual([]);
  });

  it('um diretório sem index.ts é recusado dizendo o que fazer', async () => {
    await mkdir(join(root, 'functions'), { recursive: true });
    await expect(findFunctionSources(root)).rejects.toThrow(/has no index\.ts/);
  });

  it('ignora node_modules dentro de extensions', async () => {
    await writeFunctions('extensions/node_modules/algo/functions', 'export const x = 1;');
    expect(await findFunctionSources(root)).toEqual([]);
  });
});

describe('o que impede montar o conjunto', () => {
  it('recusa um nome igual ao de uma function do Microteia', async () => {
    await writeFunctions('functions', 'export const runAction = 1;');
    const problems = functionProblems(await findFunctionSources(root), KERNEL);
    expect(problems.join()).toMatch(/"runAction", which is the name of a Microteia function/);
  });

  it('recusa o mesmo nome em duas origens, nomeando as duas', async () => {
    await writeFunctions('functions', 'export const dobrado = 1;');
    await writeFunctions('extensions/vendas/functions', 'export const dobrado = 1;');
    const problems = functionProblems(await findFunctionSources(root), KERNEL);
    expect(problems.join()).toContain('exported by both functions and extensions/vendas/functions');
  });

  it('recusa um diretório que não exporta nada, em vez de deployar o vazio', async () => {
    await writeFunctions('functions', '// nada aqui\n');
    expect(functionProblems(await findFunctionSources(root), KERNEL).join()).toMatch(/exports nothing/);
  });

  it('não reclama de um conjunto válido', async () => {
    await writeFunctions('functions', 'export const shared = 1;');
    await writeFunctions('extensions/vendas/functions', 'export const vendasHook = 1;');
    expect(functionProblems(await findFunctionSources(root), KERNEL)).toEqual([]);
  });

  /**
   * O portão de instalação entra na MESMA porta que o nome repetido, e pelo mesmo motivo: é aqui que a
   * fonte do escritório passa a fazer parte do pacote que vai subir. Um gatilho sem portão dispara para
   * todos os escritórios do projeto, e o sintoma dele não é uma falha — é código de uma extensão que
   * ninguém tem mais agindo sobre dados alheios.
   */
  it('recusa um gatilho de extensão sem o portão de instalação', async () => {
    await writeFunctions(
      'extensions/vendas/functions',
      "export const vendasOnSave = onDocumentWritten({ document: 'tenants/{tenantId}/x/{id}' }, h);",
    );

    expect(functionProblems(await findFunctionSources(root), KERNEL).join())
      .toContain('exports "vendasOnSave", a onDocumentWritten trigger with no installation gate');
  });

  it('não reclama do gatilho que passa pelo portão', async () => {
    await writeFunctions(
      'extensions/vendas/functions',
      "export const vendasOnSave = onDocumentWritten(o, forInstalledExtension('com.acme.vendas', h));",
    );

    expect(functionProblems(await findFunctionSources(root), KERNEL)).toEqual([]);
  });

  /** O gatilho mora no arquivo dele e é reexportado pelo `index.ts` — é o que o molde escreve. */
  it('acha o gatilho declarado fora do index.ts', async () => {
    await writeFunctions('extensions/vendas/functions', "export { vendasOnSave } from './vendasOnSave';");
    await writeFile(
      join(root, 'extensions/vendas/functions/vendasOnSave.ts'),
      "export const vendasOnSave = onDocumentWritten({ document: 'tenants/{tenantId}/x/{id}' }, h);",
    );

    expect(functionProblems(await findFunctionSources(root), KERNEL).join())
      .toContain('with no installation gate');
  });

  it('não cobra portão da function comum, que não tem instalação de onde perguntar', async () => {
    await writeFunctions(
      'functions',
      "export const sharedOnSave = onDocumentWritten({ document: 'tenants/{tenantId}/x/{id}' }, h);",
    );

    expect(functionProblems(await findFunctionSources(root), KERNEL)).toEqual([]);
  });
});

describe('a montagem dentro de install/', () => {
  const install = (): string => join(root, '.microteia', 'install');

  it('copia cada origem para a sua pasta e gera o barril', async () => {
    await writeFunctions('functions', 'export const shared = 1;');
    await writeFunctions('extensions/vendas/functions', 'export const vendasHook = 1;');

    const result = await gatherCustomFunctions(root, install(), KERNEL);
    expect(result.functions).toEqual(['shared', 'vendasHook']);

    const target = join(install(), 'functions/custom/src');
    expect(await readFile(join(target, 'shared/index.ts'), 'utf8')).toContain('shared');
    expect(await readFile(join(target, 'vendas/index.ts'), 'utf8')).toContain('vendasHook');

    const generated = await readFile(join(target, 'index.ts'), 'utf8');
    expect(generated).toContain("export * from './shared';");
    expect(generated).toContain("export * from './vendas';");
    expect(generated).toContain('rebuilt on every deploy');
  });

  it('numa instalação sem function nenhuma, escreve um barril vazio que compila', async () => {
    const result = await gatherCustomFunctions(root, install(), KERNEL);
    expect(result.sources).toEqual([]);
    expect(await readFile(join(install(), 'functions/custom/src/index.ts'), 'utf8')).toContain('export {};');
  });

  /**
   * O diretório é DERIVADO. Um resto da montagem anterior seria deployado sem que nada apontasse a
   * origem dele — o tipo de function fantasma que ninguém sabe de onde veio.
   */
  it('apaga o que sobrou da montagem anterior', async () => {
    await writeFunctions('extensions/antiga/functions', 'export const antiga = 1;');
    await gatherCustomFunctions(root, install(), KERNEL);

    await writeFunctions('extensions/nova/functions', 'export const nova = 1;');
    const { readdir, rm } = await import('node:fs/promises');
    await rm(join(root, 'extensions/antiga'), { recursive: true, force: true });

    await gatherCustomFunctions(root, install(), KERNEL);
    const entries = await readdir(join(install(), 'functions/custom/src'));
    expect(entries.sort()).toEqual(['index.ts', 'nova']);
  });

  it('a recusa acontece ANTES de escrever qualquer coisa', async () => {
    await writeFunctions('functions', 'export const runAction = 1;');
    await expect(gatherCustomFunctions(root, install(), KERNEL)).rejects.toThrow(/cannot be assembled/);
  });
});

/**
 * As de `functions/` são COMUNS e não têm dono que possa reivindicá-las — duas extensões não podem
 * declarar o mesmo nome —, então sobem no `deploy`, sempre. As de `extensions/<plugin>/functions/` têm
 * dono e sobem pelo provisionamento, só onde a extensão está instalada: é o mesmo "empacotar não é
 * deployar" que já valia para as functions do kernel reivindicadas por extensão.
 *
 * A distinção sai do LUGAR do arquivo, e é por isso que ela não pode ser declarada errada.
 */
describe('quem sobe no deploy e quem sobe no provisionamento', () => {
  it('separa a comum, que não tem dono, da que pertence a uma extensão', async () => {
    await writeFunctions('functions', 'export const compartilhada = 1;');
    await writeFunctions('extensions/integracao/functions', 'export const integracaoWatch = 1;');

    const office = await readOfficeFunctions(root);
    expect(office.all.sort()).toEqual(['compartilhada', 'integracaoWatch']);
    expect(office.shared).toEqual(['compartilhada']);
  });

  it('numa instalação sem function nenhuma, as duas listas são vazias', async () => {
    const office = await readOfficeFunctions(root);
    expect(office.all).toEqual([]);
    expect(office.shared).toEqual([]);
  });
});

/**
 * Só as callables podem ser conferidas de fora, e só nelas a permissão de invocação pública importa:
 * sem ela a aplicação abre e toda chamada falha no navegador PARECENDO erro de CORS, o que manda
 * procurar no frontend, que está correto. A do escritório paga o mesmo preço que a do kernel, e por
 * isso entra na mesma conferência.
 */
describe('as callables do escritório', () => {
  it('reconhece a onCall declarada num arquivo do diretório, não só no index', async () => {
    await mkdir(join(root, 'extensions/integracao/functions'), { recursive: true });
    await writeFile(
      join(root, 'extensions/integracao/functions/exchangeCode.ts'),
      "import { onCall } from 'firebase-functions/v2/https';\n"
      + 'export const exchangeCode = onCall({}, () => ({ ok: true }));\n',
    );
    await writeFile(
      join(root, 'extensions/integracao/functions/index.ts'),
      "export { exchangeCode } from './exchangeCode';\n",
    );

    const office = await readOfficeFunctions(root);
    expect(office.callables).toEqual(['exchangeCode']);
  });

  /** Escrita e não exportada, ela não é deployada — conferir o alcance dela mandaria procurar nada. */
  it('ignora a que o index.ts não exporta, porque ela não vai ser deployada', async () => {
    await mkdir(join(root, 'extensions/integracao/functions'), { recursive: true });
    await writeFile(
      join(root, 'extensions/integracao/functions/rascunho.ts'),
      "import { onCall } from 'firebase-functions/v2/https';\n"
      + 'export const rascunho = onCall({}, () => ({}));\n',
    );
    await writeFunctions('extensions/integracao/functions', 'export const outra = 1;');

    expect((await readOfficeFunctions(root)).callables).toEqual([]);
  });

  it('um gatilho não é callable', async () => {
    await writeFunctions(
      'extensions/integracao/functions',
      "import { onMessagePublished } from 'firebase-functions/v2/pubsub';\n"
      + 'export const integracaoSyncOffice = onMessagePublished({ topic: "gmail" }, async () => {});\n',
    );
    const office = await readOfficeFunctions(root);
    expect(office.all).toEqual(['integracaoSyncOffice']);
    expect(office.callables).toEqual([]);
  });
});

/**
 * O `firebase-functions` valida os `defineString` GLOBALMENTE, e não por function: um parâmetro sem
 * valor e sem `default` recusa o deploy de TODAS elas, inclusive as que nada têm com ele. Foi assim que
 * um `EXAMPLE_TOPIC` ausente derrubou o deploy de `callAIProxy` numa instalação nova.
 *
 * Por isso o parâmetro que uma function do escritório declara tem de chegar ao `.env.<projectId>` — e
 * por isso a lista é DERIVADA do código dele, como a do pacote já era.
 */
describe('os parâmetros que as functions do escritório declaram', () => {
  it('acha o defineString num arquivo fundo do diretório', async () => {
    await mkdir(join(root, 'extensions/integracao/functions/gmail'), { recursive: true });
    await writeFile(
      join(root, 'extensions/integracao/functions/gmail/auth.ts'),
      "import { defineString } from 'firebase-functions/params';\n"
      + "export const clientId = defineString('EXAMPLE_CLIENT_ID');\n"
      + "export const redirect = defineString('EXAMPLE_REDIRECT', { default: 'postmessage' });\n",
    );
    await writeFunctions('extensions/integracao/functions', 'export const integracaoSyncOffice = 1;');

    const office = await readOfficeFunctions(root);
    expect(office.parameters).toEqual([
      { name: 'EXAMPLE_CLIENT_ID', required: true },
      { name: 'EXAMPLE_REDIRECT', required: false },
    ]);
  });

  /** O mesmo parâmetro em duas functions é UM parâmetro; e quem o exige decide o `required`. */
  it('junta o mesmo nome declarado em vários lugares, mantendo a exigência', async () => {
    await mkdir(join(root, 'extensions/integracao/functions'), { recursive: true });
    await writeFile(
      join(root, 'extensions/integracao/functions/a.ts'),
      "import { defineString } from 'firebase-functions/params';\n"
      + "const t = defineString('EXAMPLE_TOPIC', { default: '' });\nexport const a = t;\n",
    );
    await writeFile(
      join(root, 'extensions/integracao/functions/b.ts'),
      "import { defineString } from 'firebase-functions/params';\n"
      + "const t = defineString('EXAMPLE_TOPIC');\nexport const b = t;\n",
    );
    await writeFunctions('extensions/integracao/functions', 'export const c = 1;');

    expect((await readOfficeFunctions(root)).parameters)
      .toEqual([{ name: 'EXAMPLE_TOPIC', required: true }]);
  });

  it('não inventa parâmetro onde não há defineString', async () => {
    await writeFunctions('functions', 'export const simples = 1;');
    expect((await readOfficeFunctions(root)).parameters).toEqual([]);
  });

  /** Teste não é código deployado, e um `defineString` de fixture não pode pedir credencial de ninguém. */
  it('ignora os arquivos de teste do diretório', async () => {
    await mkdir(join(root, 'extensions/integracao/functions'), { recursive: true });
    await writeFile(
      join(root, 'extensions/integracao/functions/auth.test.ts'),
      "import { defineString } from 'firebase-functions/params';\n"
      + "defineString('DE_FIXTURE');\n",
    );
    await writeFunctions('extensions/integracao/functions', 'export const x = 1;');
    expect((await readOfficeFunctions(root)).parameters).toEqual([]);
  });
});

/**
 * Uma function do escritório pode precisar de um pacote npm que o kernel não usa — o `push` precisa de
 * `googleapis`, e o kernel não tem por que carregá-lo. As dependências não podem viajar no pacote,
 * porque o kernel não sabe o que o escritório vai escrever; então o diretório as declara, e o deploy as
 * acrescenta.
 */
describe('as dependências npm que um diretório de functions declara', () => {
  const withDeps = async (relative: string, deps: Record<string, string>): Promise<void> => {
    await writeFunctions(relative, 'export const x = 1;');
    await writeFile(join(root, relative, 'package.json'), JSON.stringify({ dependencies: deps }));
  };

  it('acrescenta o que o kernel não traz', async () => {
    await withDeps('extensions/integracao/functions', { googleapis: '^140.0.1' });
    const plan = dependencyPlan(await findFunctionSources(root), { 'firebase-admin': '^12.0.0' });
    expect(plan.added).toEqual({ googleapis: '^140.0.1' });
    expect(plan.problems).toEqual([]);
  });

  /**
   * A faixa do PACOTE vence, e o fato é relatado. O runtime das functions é escolha de quem publica o
   * kernel: uma extensão que o movesse por baixo o moveria para todas as outras.
   */
  it('não deixa uma extensão mover a faixa que o pacote escolheu', async () => {
    await withDeps('extensions/integracao/functions', { 'firebase-admin': '^11.0.0' });
    const plan = dependencyPlan(await findFunctionSources(root), { 'firebase-admin': '^12.0.0' });
    expect(plan.added).toEqual({});
    expect(plan.overridden.join()).toContain('firebase-admin: extensions/integracao/functions asks for ^11.0.0');
  });

  /** Duas faixas para o mesmo pacote não têm dono: uma instalação tem UM node_modules. */
  it('recusa duas faixas divergentes entre diretórios, nomeando os dois', async () => {
    await withDeps('extensions/integracao/functions', { googleapis: '^140.0.0' });
    await withDeps('extensions/agenda/functions', { googleapis: '^144.0.0' });
    const plan = dependencyPlan(await findFunctionSources(root), {});
    expect(plan.problems.join()).toContain('extensions/agenda/functions');
    expect(plan.problems.join()).toContain('extensions/integracao/functions');
  });

  it('a mesma faixa em dois diretórios não é conflito', async () => {
    await withDeps('extensions/integracao/functions', { googleapis: '^140.0.0' });
    await withDeps('extensions/agenda/functions', { googleapis: '^140.0.0' });
    expect(dependencyPlan(await findFunctionSources(root), {}).problems).toEqual([]);
  });

  it('o package.json é opcional — quem só usa o que já vem não escreve nenhum', async () => {
    await writeFunctions('extensions/integracao/functions', 'export const x = 1;');
    expect(dependencyPlan(await findFunctionSources(root), {}).added).toEqual({});
  });

  it('a montagem escreve as declaradas no package.json do pacote', async () => {
    const install = join(root, '.microteia', 'install');
    await mkdir(join(install, 'functions'), { recursive: true });
    await writeFile(
      join(install, 'functions/package.json'),
      JSON.stringify({ name: 'microteia-functions', dependencies: { 'firebase-admin': '^12.0.0' } }),
    );
    await withDeps('extensions/integracao/functions', { googleapis: '^140.0.1' });

    const result = await gatherCustomFunctions(root, install, KERNEL);
    expect(result.dependencies.added).toEqual({ googleapis: '^140.0.1' });

    const written = JSON.parse(await readFile(join(install, 'functions/package.json'), 'utf8')) as {
      name: string;
      dependencies: Record<string, string>;
    };
    expect(written.dependencies).toEqual({ 'firebase-admin': '^12.0.0', googleapis: '^140.0.1' });
    expect(written.name).toBe('microteia-functions');
  });
});

/**
 * Teste NÃO entra no artefato, e a razão é um deploy que falhou por inteiro.
 *
 * O `predeploy` do pacote compila `custom/` com o `tsc`. Um `import { describe } from 'vitest'` ali
 * dentro é `Cannot find module`: o `vitest` é dependência de desenvolvimento do escritório e não pode
 * ser dependência das functions deployadas. A compilação falha, e com ela falha o deploy de TODAS as
 * functions — as cinco de uma extensão falharam juntas, com o relatório culpando cada uma delas.
 *
 * O `AGENTS.md` manda o autor escrever teste ao lado da function. Era este lado que faltava.
 */
describe('o que de um diretório de functions vai para dentro do pacote', () => {
  const install = (): string => join(root, '.microteia', 'install');

  const withFiles = async (files: Record<string, string>): Promise<void> => {
    for (const [relative, content] of Object.entries(files)) {
      const target = join(root, 'extensions/push/functions', relative);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, content);
    }
  };

  it('deixa o teste de fora, e leva o código', async () => {
    await withFiles({
      'index.ts': "export { gmailPush } from './gmailPush';\n",
      'gmailPush.ts': 'export const gmailPush = 1;\n',
      'gmailPush.test.ts': "import { it } from 'vitest';\nit('x', () => {});\n",
      'parsers/tjba.ts': 'export const parse = () => null;\n',
      'parsers/tjba.test.ts': "import { it } from 'vitest';\nit('y', () => {});\n",
      '__tests__/extra.ts': "import { it } from 'vitest';\nit('z', () => {});\n",
    });

    await gatherCustomFunctions(root, install(), KERNEL);
    const staged = join(install(), 'functions/custom/src/push');

    expect(await readdir(staged)).toEqual(expect.arrayContaining(['index.ts', 'gmailPush.ts', 'parsers']));
    expect(await readdir(staged)).not.toContain('gmailPush.test.ts');
    expect(await readdir(staged)).not.toContain('__tests__');
    expect(await readdir(join(staged, 'parsers'))).toEqual(['tjba.ts']);
  });

  /**
   * O `__fixtures__` ENTRA: é módulo comum, compila sozinho, e reconhecê-lo pelo nome do diretório
   * seria heurística. O que se exclui aqui são as duas convenções inequívocas.
   */
  it('e não tenta adivinhar o que não é teste pelo nome do diretório', async () => {
    await withFiles({
      'index.ts': 'export const x = 1;\n',
      '__fixtures__/emails.ts': 'export const EMAIL = "...";\n',
    });

    await gatherCustomFunctions(root, install(), KERNEL);
    expect(await readdir(join(install(), 'functions/custom/src/push')))
      .toEqual(expect.arrayContaining(['__fixtures__', 'index.ts']));
  });

  /** O exportado continua saindo do `index.ts`, que nunca é teste. */
  it('o conjunto deployado não muda por causa do filtro', async () => {
    await withFiles({
      'index.ts': "export { gmailPush } from './gmailPush';\n",
      'gmailPush.ts': 'export const gmailPush = 1;\n',
      'gmailPush.test.ts': "import { it } from 'vitest';\nit('x', () => {});\n",
    });

    const result = await gatherCustomFunctions(root, install(), KERNEL);
    expect(result.functions).toEqual(['gmailPush']);
  });
});
