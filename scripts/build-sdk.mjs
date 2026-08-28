/**
 * Monta `sdk/` — o pacote `@microteia/sdk` que viaja no `.tgz` do kernel e é o que um escritório
 * instala para escrever extensão em TypeScript no VSCode.
 *
 *   npm run build:sdk            # compila e escreve o pacote
 *   npm run build:sdk -- --check # confere o artefato sem reescrever (usado no verify)
 *
 * O diretório é INTEIRAMENTE gerado, por isso está no `.gitignore`: a fonte é `src/sdk/` mais o
 * `tsconfig.sdk.json`, e o manifesto do pacote é escrito aqui — como `packageTemplates.ts` faz para o
 * pacote do kernel, e pelo mesmo motivo (uma versão duplicada à mão divergiria em silêncio).
 *
 * As três conferências no fim são do ARTEFATO, não do procedimento: é a mesma postura de
 * `bundleAudit.ts`, que varre o bundle pronto em vez de confiar em ter rodado o build certo.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const check = process.argv.includes('--check');
const root = process.cwd();
const sdkDir = join(root, 'sdk');
const libDir = join(sdkDir, 'lib');

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const kernelVersion = /KERNEL_VERSION\s*=\s*'([^']+)'/.exec(
  readFileSync(join(root, 'src/domain/schema/plugin/kernelVersion.ts'), 'utf8'),
)?.[1];
if (!kernelVersion) throw new Error('Could not read KERNEL_VERSION from kernelVersion.ts.');

/**
 * SEM `"type": "module"`: o `tsconfig.sdk.json` emite CommonJS, e a raiz deste repositório é ESM —
 * sem este manifesto, o Node herda o `type` da raiz e recusa o próprio compilado do SDK.
 */
const packageJson = () => `${JSON.stringify({
  name: '@microteia/sdk',
  version: pkg.version,
  description: 'Author Microteia extensions in TypeScript.',
  license: 'UNLICENSED',
  main: 'lib/sdk/index.js',
  types: 'lib/sdk/index.d.ts',
  // Duas entradas, e a distinção é real: `@microteia/sdk` é isomórfico (tipos, validação, construtores)
  // e `@microteia/sdk/node` é a FERRAMENTA — o compilador, que lê arquivo e por isso só roda em Node.
  // Sem a segunda, o teste de um pacote autorado não tem como validar o `.json` de verdade.
  exports: {
    '.': { types: './lib/sdk/index.d.ts', default: './lib/sdk/index.js' },
    './node': { types: './lib/sdk/node/compile.d.ts', default: './lib/sdk/node/compile.js' },
  },
  bin: { 'microteia-plugin': 'lib/sdk/node/cli.js' },
  engines: { node: '>=22' },
  dependencies: { 'expr-eval': pkg.dependencies['expr-eval'], sucrase: pkg.dependencies.sucrase },
  microteia: { kernelVersion },
}, null, 2)}\n`;

const readme = () => `# @microteia/sdk ${pkg.version}

Author Microteia extensions in TypeScript, with real types and a compiler that produces the \`.json\`
the platform installs.

    npx microteia-plugin new com.example.hello
    npx microteia-plugin check
    npx microteia-plugin build

Kernel contract: ${kernelVersion}. See \`AUTHORING.md\` in your \`extensions/\` directory.
`;

const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const path = join(dir, entry.name);
  return entry.isDirectory() ? walk(path) : [path];
});

if (!check) {
  rmSync(libDir, { recursive: true, force: true });
  mkdirSync(sdkDir, { recursive: true });
  execFileSync('npx', ['tsc', '-p', 'tsconfig.sdk.json'], { cwd: root, stdio: 'inherit' });
  writeFileSync(join(sdkDir, 'package.json'), packageJson());
  writeFileSync(join(sdkDir, 'README.md'), readme());
}

let ok = true;
const fail = (message) => { ok = false; console.error(`❌ ${message}`); };

try {
  statSync(libDir);
} catch {
  fail('sdk/lib does not exist — run "npm run build:sdk".');
}

if (ok) {
  const files = walk(libDir).map((path) => path.slice(sdkDir.length + 1));

  // 1. Nenhum comentário sai daqui. O JSDoc do repositório é em português e narra decisões e
  //    incidentes internos; a documentação do autor é o AUTHORING.md, escrito para ele.
  for (const file of files.filter((f) => f.endsWith('.d.ts'))) {
    if (readFileSync(join(sdkDir, file), 'utf8').includes('/*')) {
      fail(`${file} carries comments — "removeComments" must stay on in tsconfig.sdk.json.`);
    }
  }

  // 2. Nem source map: sem o `src/` que eles apontam são inúteis, e entregariam a árvore interna.
  const maps = files.filter((file) => file.endsWith('.map'));
  if (maps.length > 0) fail(`source maps in the package: ${maps.join(', ')}`);

  // 3. Nada além do previsto. Um arquivo que caiu aqui por engano viajaria para todo escritório.
  const stray = files.filter((file) => !file.startsWith('lib/'));
  if (stray.length > 0) fail(`unexpected files: ${stray.join(', ')}`);

  // 4. Os tipos são de outro passo, e faltarem quebraria o IntelliSense sem quebrar o build. O do `?raw`
  //    tem peso próprio: sem ele, o import mais importante de um `plugin.ts` vira erro no editor.
  for (const declaration of [
    'types/microteia-host.d.ts',
    'types/microteia-raw.d.ts',
    'types/microteia-office.d.ts',
  ]) {
    if (!existsSync(join(sdkDir, declaration))) {
      fail(`sdk/${declaration} is missing — run "npm run build:host-types".`);
    }
  }

  const manifest = JSON.parse(readFileSync(join(sdkDir, 'package.json'), 'utf8'));

  // Os caminhos declarados têm de EXISTIR. Um `bin` errado não quebra o `npm install` — ele apenas não
  // cria o atalho, e o autor recebe um "404 Not Found" do registry ao chamar a ferramenta, como se ela
  // nunca tivesse sido publicada. Nada aponta para a causa.
  const declaredPaths = [
    ['main', manifest.main],
    ...Object.entries(manifest.bin).map(([name, target]) => [`bin.${name}`, target]),
    ...Object.entries(manifest.exports).flatMap(([entry, map]) =>
      Object.entries(map).map(([condition, target]) => [`exports["${entry}"].${condition}`, target])),
  ];
  for (const [field, target] of declaredPaths) {
    if (!existsSync(join(sdkDir, target))) fail(`package.json ${field} points at ${target}, which does not exist.`);
  }

  if (manifest.version !== pkg.version) {
    fail(`sdk/package.json says ${manifest.version}, the product is ${pkg.version} — run "npm run build:sdk".`);
  }
  if (manifest.microteia?.kernelVersion !== kernelVersion) {
    fail(`sdk/package.json says kernel ${manifest.microteia?.kernelVersion}, the source says ${kernelVersion}.`);
  }

  if (ok) console.log(`✅ @microteia/sdk ${pkg.version} (kernel ${kernelVersion}) — ${files.length} files`);
}

if (!ok) process.exitCode = 1;
