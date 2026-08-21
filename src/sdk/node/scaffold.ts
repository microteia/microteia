import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { isValidPluginId } from '../../domain/schema/plugin/pluginManifest';
import { KERNEL_VERSION } from '../../domain/schema/plugin/kernelVersion';

/**
 * O molde de uma extensão. Um molde que COMPILA e PASSA no `check` desde o primeiro segundo — porque a
 * primeira coisa que um autor (ou uma IA) faz é rodar o gate, e um molde que já falha ensina a ignorá-lo.
 *
 * O que ele gera depende do que a extensão VAI SER, e é por isso que o `create` pergunta: uma extensão
 * que só traz uma automação não deveria nascer com uma tela e uma página em código para apagar. Cada
 * pedaço existe para provar um mecanismo, e vem só se for pedido.
 */

/** `com.example.hello-world` -> `helloWorld`; é o nome do export e a base das chaves. */
const camelOf = (id: string): string => {
  const last = id.split('.').pop() ?? id;
  return last.replace(/[-_]+(.)/g, (_match, char: string) => char.toUpperCase());
};

/** `com.example.hello-world` -> `hello-world`; é o nome da pasta. */
export const folderOf = (id: string): string => id.split('.').pop() ?? id;

export interface PluginSpec {
  id: string;
  name: string;
  summary: string;
  publisher: string;
  /** Declara uma ENTIDADE: coleção, campos, e a listagem/detalhe que o Kernel desenha. */
  screen: boolean;
  /** Uma página em CÓDIGO, num `.tsx` de verdade. */
  view: boolean;
  /** Cloud Functions próprias, em `<plugin>/functions/`. */
  functions: boolean;
}

const messagesTs = (spec: PluginSpec): string => {
  const entries = [
    `  'extension.name': '${spec.name.replace(/'/g, "\\'")}',`,
    `  'extension.description': '${spec.summary.replace(/'/g, "\\'")}',`,
    ...(spec.screen ? [
      "  'nav.label': 'Items',",
      "  'entity.singular': 'Item',",
      "  'entity.plural': 'Items',",
      "  'field.title': 'Title',",
      "  'field.notes': 'Notes',",
      "  'field.due-date': 'Due date',",
    ] : []),
    ...(spec.view ? [
      "  'page.summary': 'Summary',",
      "  'summary.total': '{count} item(s)',",
      "  'summary.empty': 'Nothing here yet.',",
    ] : []),
  ];

  return `import type { MessageBundle } from '@microteia/sdk';

/**
 * Every label this extension shows. The kernel does not translate an extension's vocabulary — the
 * extension that declares a word answers for it. Ship 'en' always; add one bundle per language.
 */
const EN: Record<string, string> = {
${entries.join('\n')}
};

export const MESSAGES: MessageBundle[] = [
  { locale: 'en', namespace: '${spec.id}', messages: EN },
  // { locale: 'pt-BR', namespace: '${spec.id}', messages: PT_BR },
];
`;
};

const pluginTs = (spec: PluginSpec): string => {
  const name = camelOf(spec.id);
  const folder = folderOf(spec.id);
  const collection = `${name}Items`;

  const contributions = [
    ...(spec.screen
      ? [`      nav({ key: COLLECTION, label: label('nav.label'), icon: 'star', order: 50 }),`]
      : []),
    ...(spec.view
      ? [`      page({ key: '${folder}-summary', title: label('page.summary'), icon: 'chart' }, '${folder}-summary'),`]
      : []),
    `      // Translations are a contribution like any other: the extension answers for its own words.`,
    `      ...MESSAGES.map((bundle) => messageBundleContribution(bundle)),`,
  ];

  const imports = ['messageBundleContribution'];
  if (spec.screen) imports.push('nav');
  if (spec.view) imports.push('page');

  const types = ['AuthoredPlugin'];
  if (spec.screen) types.push('TemplateField');

  const fields = spec.screen
    ? `
const FIELDS: TemplateField[] = [
  { key: 'title', label: label('field.title'), type: 'text', required: true, order: 0 },
  { key: 'notes', label: label('field.notes'), type: 'textarea', required: false, order: 1 },
  { key: 'dueDate', label: label('field.due-date'), type: 'date', required: false, order: 2, filterable: true },
];
`
    : '';

  const screens = spec.screen
    ? `
  // The list, the detail, the form and the filters are drawn by the platform. You write none of it.
  screens: [
    {
      key: COLLECTION,
      titleSingular: label('entity.singular'),
      titlePlural: label('entity.plural'),
      titleFieldKey: 'title',
      icon: 'star',
      fields: FIELDS,
    },
  ],
`
    : '';

  const views = spec.view
    ? `
  // Views travel as SOURCE and are compiled by the browser at runtime. Authored as a real .tsx file so
  // tsc and your editor check it: "sourceFile" is replaced by its contents at build time.
  views: [
    { key: '${folder}-summary', title: label('page.summary'), icon: 'chart', sourceFile: './views/Summary.view.tsx' },
  ],
`
    : '';

  const backend = spec.functions
    ? `
    // What this extension needs from the Firebase project. It stays PENDING, and does not load, until
    // an administrator runs "microteia provision".
    backend: {
      functions: ['${name}Hello'],
    },
`
    : '';

  return `import type { ${types.join(', ')} } from '@microteia/sdk';
import { ${imports.join(', ')} } from '@microteia/sdk';
import { MESSAGES } from './messages';

/**
 * ${spec.id}
 *
 * The .json that "microteia-plugin build" produces from this file is what the platform installs. This
 * file is the source: it gets types, autocomplete and unit tests; the .json gets installed.
 */

const NAMESPACE = '${spec.id}';${spec.screen ? `\nconst COLLECTION = '${collection}';` : ''}

/** A message reference. Resolved against the catalog in messages.ts, so every label can be translated. */
const label = (key: string): string => \`@\${NAMESPACE}/\${key}\`;
${fields}
export const ${name}Plugin: AuthoredPlugin = {
  manifest: {
    id: NAMESPACE,
    version: '1.0.0',
    kernel: '^${KERNEL_VERSION}',
    name: label('extension.name'),
    description: label('extension.description'),
    publisher: { name: '${spec.publisher.replace(/'/g, "\\'")}' },${backend}
    contributes: [
${contributions.join('\n')}
    ],
  },
  summary: '${spec.summary.replace(/'/g, "\\'")}',
${screens}${views}
  workflows: [],
};

export default ${name}Plugin;
`;
};

const viewTsx = (spec: PluginSpec): string => {
  const collection = `${camelOf(spec.id)}Items`;
  const reads = spec.screen ? collection : 'persons';

  return `import { useMemo } from 'react';
import { useTheme } from 'styled-components';
import { Card } from '@microteia/ui';
import { useCollection, useOpenRecord } from '@microteia/data';
import { useT } from '@microteia/i18n';

/**
 * A page delivered as CODE. It may only import from the curated host API — '@microteia/*', 'react' and
 * 'styled-components'. Any other import is refused at runtime, by design.
 *
 * Because this is a real .tsx file, "npx tsc --noEmit" checks it and your editor completes it. The
 * compiler inlines it into the .json; the browser compiles and evaluates it there.
 */
export default function SummaryView() {
  const theme = useTheme();
  const items = useCollection('${reads}');
  const openRecord = useOpenRecord();
  const t = useT('${spec.id}');

  const upcoming = useMemo(
    () => items
      .filter((item) => typeof item.dueDate === 'string')
      .sort((left, right) => String(left.dueDate).localeCompare(String(right.dueDate)))
      .slice(0, 10),
    [items],
  );

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h2 style={{ color: theme.colors.text, margin: 0 }}>{t('summary.total', { count: items.length })}</h2>

      {upcoming.length === 0 ? (
        <p style={{ color: theme.colors.textSecondary }}>{t('summary.empty')}</p>
      ) : (
        upcoming.map((item) => (
          <Card key={item.id} onClick={() => openRecord('${reads}', item.id)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <strong style={{ color: theme.colors.text }}>{String(item.title ?? '')}</strong>
              <span style={{ color: theme.colors.textSecondary }}>{String(item.dueDate ?? '')}</span>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
`;
};

const testTs = (spec: PluginSpec): string => {
  const name = camelOf(spec.id);
  return `import { describe, expect, it } from 'vitest';
import { buildPlugin } from '@microteia/sdk/node';
import { ${name}Plugin } from './plugin';

/**
 * The same validation the platform runs on install. Keeping it as a test means a broken package fails
 * here, in a second, instead of in someone's organization.
 *
 * It validates the BUILT package, not the source: only after the compiler inlines every 'sourceFile' is
 * the package what the platform will actually receive.
 */
describe('${spec.id}', () => {
  const built = buildPlugin({ entry: new URL('./plugin.ts', import.meta.url).pathname });

  it('has no problems the platform would refuse', () => {
    expect(built.issues).toEqual([]);
  });

  it('every screen field has a translatable label', () => {
    for (const screen of ${name}Plugin.screens ?? []) {
      for (const field of screen.fields) {
        expect(field.label, field.key).toMatch(/^@/);
      }
    }
  });
});
`;
};

/** O nome de uma Cloud Function, a partir do id da extensão e do que se pediu. */
export const functionName = (pluginId: string, action: string): string => {
  const base = camelOf(pluginId);
  const suffix = action.replace(/[^a-zA-Z0-9]+(.)/g, (_m, c: string) => c.toUpperCase());
  return `${base}${suffix.charAt(0).toUpperCase()}${suffix.slice(1)}`;
};

/**
 * Uma Cloud Function do escritório. A REGIÃO é obrigatória e é a da instalação: uma function em outra
 * região não recebe os gatilhos do Firestore, e o deploy não acusa nada.
 */
export const functionTs = (name: string, region: string): string =>
  `import { onCall } from 'firebase-functions/v2/https';

/**
 * ${name}
 *
 * Pinned to ${region}: a function in another region does not receive this project's Firestore triggers,
 * and nothing in the deploy tells you so.
 *
 * Reachable from an extension view with useCallable('${name}') from '@microteia/functions'.
 */
export const ${name} = onCall({ region: '${region}', cors: true }, (request) => {
  if (request.auth === undefined) throw new Error('Sign-in required.');

  return { ok: true, calledBy: request.auth.uid };
});
`;

const functionsIndexTs = (names: string[]): string =>
  `// The Cloud Functions of this extension, read through this file: what is exported here is what gets
// deployed. Declare each one in "manifest.backend.functions" too — that is what makes it go up only
// where this extension is installed, by "microteia provision".
//
// Needs an npm package the platform does not carry? Declare it in "dependencies" in a package.json
// next to this file. Needs a credential? defineString('NAME') here, and 'NAME' in
// "manifest.backend.parameters".

${names.map((name) => `export { ${name} } from './${name}';`).join('\n')}
`;

/**
 * O `VERSIONS.md` da extensão. Mesma separação que vale no repositório do kernel: a mensagem de commit
 * é para quem escreve o código, e esta entrada é para quem USA a extensão — uma frase sobre o que
 * mudou, sem nome de arquivo, de campo interno ou de função.
 *
 * Nasce junto com a extensão porque um histórico que começa na segunda versão nunca começa: quando
 * alguém percebe que faz falta, a primeira mudança já foi publicada sem registro.
 */
const versionsMd = (spec: PluginSpec, date: string): string => `# Release notes — ${spec.name}

> What changed in this extension, in the words of someone who uses it. The technical history is in
> your commits; this file is not.

Each entry matches \`manifest.version\` in \`plugin.ts\`. The newest one goes on top.

<!-- A new entry goes here, above the previous ones:

#### [1.0.1] — YYYY-MM-DD

- What a person will notice, in one plain sentence.
-->

#### [1.0.0] — ${date}

- First version.
`;

/** A data de hoje, em ISO. Fora do molde para que o teste possa carimbar a sua. */
const todayIso = (): string => new Date().toISOString().slice(0, 10);

const readmeMd = (spec: PluginSpec): string => `# ${spec.id}

    npx tsc --noEmit                              # types
    npx microteia-plugin check ${folderOf(spec.id)}/plugin.ts
    npx microteia-plugin build ${folderOf(spec.id)}/plugin.ts   # writes ${spec.id}.json

Import the \`.json\` on the **Extensions** screen.
${spec.view ? `
This extension carries code (\`views\`). After importing it, an administrator has to open the source and
trust it before the view runs — see \`../AUTHORING.md\`, "Code trust".
` : ''}${spec.functions ? `
## Cloud Functions

\`functions/\` holds this extension's own Cloud Functions. \`manifest.backend.functions\` names them, and
that is what makes \`microteia provision\` deploy them only where this extension is installed — and
remove them, with \`--prune\`, when nothing needs them any more.

Add another with:

    npx microteia-plugin create function --plugin ${folderOf(spec.id)}

An npm package the platform does not carry goes in \`dependencies\` in \`functions/package.json\`. A
credential or setting is a \`defineString('NAME')\` plus \`'NAME'\` in \`manifest.backend.parameters\`; the
Console writes every one it finds into \`.env.<projectId>\`, empty, for whoever installs to fill in.
` : ''}
## Every change raises the version

Raise \`manifest.version\` in \`plugin.ts\` and add an entry at the top of \`VERSIONS.md\`, in the same
change. That entry is written for whoever *uses* the extension — what they will notice, in one plain
sentence — and is not the commit message.

    npm test        # nothing is finished while a test fails

See \`../AUTHORING.md\` for the full contract.
`;

/** A região da instalação, quando há uma ao lado. Sem ela, o padrão — e o molde diz qual usou. */
export const installationRegion = (workspace: string): string => {
  for (const candidate of [
    join(workspace, '../.microteia/install/manifest.json'),
    join(workspace, '.microteia/install/manifest.json'),
  ]) {
    try {
      const manifest = JSON.parse(readFileSync(candidate, 'utf8')) as {
        requires?: { functionsRegion?: string };
      };
      if (manifest.requires?.functionsRegion !== undefined) return manifest.requires.functionsRegion;
    } catch {
      continue;
    }
  }
  return 'southamerica-east1';
};

export interface ScaffoldResult {
  directory: string;
  files: string[];
  functionName?: string;
}

export const scaffoldPlugin = (
  spec: PluginSpec,
  parentDir: string,
  force: boolean,
): ScaffoldResult => {
  if (!isValidPluginId(spec.id)) {
    throw new Error(
      `"${spec.id}" is not a valid extension id. Use reverse-DNS, lowercase: com.example.hello-world`,
    );
  }

  const directory = join(parentDir, folderOf(spec.id));
  if (existsSync(directory) && !force) {
    throw new Error(`${directory} already exists. Use --force to overwrite it.`);
  }

  const files: string[] = [];
  const write = (relative: string, content: string): void => {
    const path = join(directory, relative);
    mkdirSync(join(path, '..'), { recursive: true });
    writeFileSync(path, content);
    files.push(relative);
  };

  mkdirSync(directory, { recursive: true });
  write('plugin.ts', pluginTs(spec));
  write('messages.ts', messagesTs(spec));
  write('plugin.test.ts', testTs(spec));
  write('README.md', readmeMd(spec));
  write('VERSIONS.md', versionsMd(spec, todayIso()));
  if (spec.view) write('views/Summary.view.tsx', viewTsx(spec));

  const result: ScaffoldResult = { directory, files };

  if (spec.functions) {
    const name = functionName(spec.id, 'hello');
    write(`functions/${name}.ts`, functionTs(name, installationRegion(parentDir)));
    write('functions/index.ts', functionsIndexTs([name]));
    result.functionName = name;
  }

  return result;
};

/** Acrescenta uma Cloud Function a uma extensão que já existe, atualizando o barril dela. */
export const scaffoldFunction = (
  pluginDir: string,
  pluginId: string,
  action: string,
  region: string,
): string => {
  const name = functionName(pluginId, action);
  const functions = join(pluginDir, 'functions');
  const target = join(functions, `${name}.ts`);

  if (existsSync(target)) throw new Error(`${name} already exists in ${functions}.`);

  mkdirSync(functions, { recursive: true });
  writeFileSync(target, functionTs(name, region));

  const index = join(functions, 'index.ts');
  const existing = existsSync(index)
    ? [...readFileSync(index, 'utf8').matchAll(/export \{ (\w+) \}/g)].map((match) => match[1])
    : [];
  writeFileSync(index, functionsIndexTs([...new Set([...existing, name])].sort()));

  return name;
};
