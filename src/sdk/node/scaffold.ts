import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { isValidPluginId } from '../../domain/schema/plugin/pluginManifest';
import { KERNEL_VERSION } from '../../domain/schema/plugin/kernelVersion';
import { withArtifactPrefix } from '../../domain/schema/plugin/artifactPrefix';

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

/** A coleção que o molde gera: `helloWorldItems`, com o prefixo do diretório quando há um. */
const collectionOf = (spec: Pick<PluginSpec, 'id' | 'prefix'>): string =>
  withArtifactPrefix(spec.prefix, 'collection', `${camelOf(spec.id)}Items`);

/** `com.example.hello-world` -> `hello-world`; é o nome da pasta. */
export const folderOf = (id: string): string => id.split('.').pop() ?? id;

export interface PluginSpec {
  id: string;
  name: string;
  summary: string;
  publisher: string;
  /**
   * O prefixo do diretório. Vai para o manifest e para a coleção que o molde gera — `acme_helloItems` —,
   * para o molde já nascer passando no gate que o prefixo declarado liga.
   */
  prefix?: string;
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
  const collection = collectionOf(spec);

  const contributions = [
    ...(spec.screen
      ? [
        `      // screen: opens the list of a screen of THIS package. Never key: the list is a tab only the`,
        `      // installation can name, because the screen's key may change there.`,
        `      nav({ screen: COLLECTION, label: label('nav.label'), icon: 'star', order: 50 }),`,
      ]
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
  // Views travel as SOURCE and are compiled by the browser at runtime. Authored as real .tsx files so
  // tsc and your editor check them: "sourceFile" is replaced by their contents at build time, merged in
  // the order given into the one module the runtime evaluates.
  //
  // Three jobs, kept apart, plus the rule that can be tested on its own: the view renders, the view model
  // keeps the state and the handlers, the styles read the theme, and Summary.rules.ts imports nothing so
  // "npm test" can call it. One file is enough for a view that only renders what a hook returned.
  views: [
    {
      key: '${folder}-summary',
      title: label('page.summary'),
      icon: 'chart',
      sourceFile: [
        './views/Summary.view.tsx',
        './views/Summary.viewmodel.tsx',
        './views/Summary.styles.tsx',
        './views/Summary.rules.ts',
      ],
    },
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
    publisher: { name: '${spec.publisher.replace(/'/g, "\\'")}' },${spec.prefix ? `\n    // The start of every name this extension creates. The gate checks it, and it never changes.\n    prefix: '${spec.prefix}',` : ''}${backend}
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

/**
 * A view do molde vem em CINCO arquivos, e não num só, porque o molde é o que vira hábito: quem começa
 * num arquivo monolítico só descobre a divisão quando ele já está grande demais para dividir. Três deles
 * são a view (render, estado, estilo); o quarto é a REGRA — sem import nenhum, que é o que a torna
 * chamável; e o quinto é o teste dela, que roda em um segundo em vez de exigir a extensão instalada.
 */
const viewFiles = (spec: PluginSpec): Record<string, string> => {
  const collection = collectionOf(spec);

  return {
    'views/Summary.rules.ts': `/**
 * The rule, outside React: it imports nothing, so a test can call it. Anything that can be WRONG — an
 * order, a total, a window of dates, which records count — belongs in a file like this one rather than
 * inside a component, where the only way to exercise it is to install the extension and look.
 */
export interface SummaryItem {
  id: string;
  title?: unknown;
  dueDate?: unknown;
}

export const upcoming = (items: SummaryItem[], limit: number): SummaryItem[] => items
  .filter((item) => typeof item.dueDate === 'string')
  .sort((left, right) => String(left.dueDate).localeCompare(String(right.dueDate)))
  .slice(0, limit);
`,

    'views/Summary.rules.test.ts': `import { describe, expect, it } from 'vitest';
import { upcoming } from './Summary.rules';

/**
 * This is the test the split pays for: the rule fails here, in a second, instead of on somebody's
 * screen. Add one whenever the view learns to decide something new.
 */
describe('upcoming', () => {
  it('puts the earliest due date first and stops at the limit', () => {
    const items = [
      { id: 'c', dueDate: '2026-03-01' },
      { id: 'a', dueDate: '2026-01-01' },
      { id: 'b', dueDate: '2026-02-01' },
    ];

    expect(upcoming(items, 2).map((item) => item.id)).toEqual(['a', 'b']);
  });

  it('leaves out a record with no due date', () => {
    expect(upcoming([{ id: 'a' }], 10)).toEqual([]);
  });
});
`,

    'views/Summary.styles.tsx': `import { styled } from 'styled-components';

/**
 * Colour comes from a theme token, never from a hex: a literal stops matching the day the organization
 * changes theme, and every organization eventually switches to the dark one. Spacing, type and radius
 * come from a token whenever one means the same thing. Ask "describe_host_module" for the names.
 */
const Page = styled.div\`
  display: flex;
  flex-direction: column;
  gap: \${({ theme }) => theme.spacing.md};
  padding: \${({ theme }) => theme.spacing.lg};
\`;

const Title = styled.h2\`
  margin: 0;
  font-size: \${({ theme }) => theme.fontSizes.xl};
  color: \${({ theme }) => theme.colors.text};
\`;

const Empty = styled.p\`
  margin: 0;
  color: \${({ theme }) => theme.colors.textSecondary};
\`;

const Row = styled.div\`
  display: flex;
  justify-content: space-between;
  gap: \${({ theme }) => theme.spacing.sm};
\`;

const Name = styled.span\`
  font-weight: 600;
  color: \${({ theme }) => theme.colors.text};
\`;

const When = styled.span\`
  color: \${({ theme }) => theme.colors.textSecondary};
\`;

export const S = { Page, Title, Empty, Row, Name, When };
`,

    'views/Summary.viewmodel.tsx': `import { useCallback, useMemo } from 'react';
import { useCollection, useOpenRecord } from '@microteia/data';
import { useT } from '@microteia/i18n';
import { upcoming, type SummaryItem } from './Summary.rules';

/**
 * The state, the data and the handlers — and no JSX. The view renders what this returns, which is what
 * lets the two be read apart.
 */
export interface SummaryViewModel {
  total: number;
  items: SummaryItem[];
  label: (key: string, params?: Record<string, unknown>) => string;
  open: (recordId: string) => void;
}

export const useSummaryViewModel = (): SummaryViewModel => {
  const records = useCollection('${collection}') as SummaryItem[];
  const openRecord = useOpenRecord();
  const label = useT('${spec.id}');

  const items = useMemo(() => upcoming(records, 10), [records]);
  const open = useCallback((recordId: string) => openRecord('${collection}', recordId), [openRecord]);

  return { total: records.length, items, label, open };
};
`,

    'views/Summary.view.tsx': `import { Card } from '@microteia/ui';
import { useSummaryViewModel } from './Summary.viewmodel';
import { S } from './Summary.styles';

/**
 * A page delivered as CODE. It may only import from the curated host API — '@microteia/*', 'react' and
 * 'styled-components'. Any other import is refused at runtime, by design.
 *
 * Because these are real .tsx files, "npx tsc --noEmit" checks them and your editor completes them. The
 * compiler merges the list declared in "sourceFile" into one module and inlines it into the .json; the
 * browser compiles and evaluates it there. This file renders, and keeps no state of its own.
 */
export default function SummaryView() {
  const vm = useSummaryViewModel();

  return (
    <S.Page>
      <S.Title>{vm.label('summary.total', { count: vm.total })}</S.Title>

      {vm.items.length === 0 ? (
        <S.Empty>{vm.label('summary.empty')}</S.Empty>
      ) : (
        vm.items.map((item) => (
          <Card key={item.id} onClick={() => vm.open(item.id)}>
            <S.Row>
              <S.Name>{String(item.title ?? '')}</S.Name>
              <S.When>{String(item.dueDate ?? '')}</S.When>
            </S.Row>
          </Card>
        ))
      )}
    </S.Page>
  );
}
`,
  };
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
export const functionTs = (name: string, pluginId: string, region: string): string =>
  `import { onCall } from 'firebase-functions/v2/https';
import { requireInstalledExtension } from 'microteia-functions/office';

/**
 * ${name}
 *
 * Reachable from an extension view with useCallable('${name}') from '@microteia/functions'.
 *
 * requireInstalledExtension makes the three refusals this callable owes before it looks at the payload:
 * the caller signed in, the caller belongs to that organization, and this extension is installed and
 * active there. It returns the caller's uid.
 *
 * The middle one is the one that is not obvious. The deploy makes every callable publicly invocable, so
 * what stands between this function and the internet is only the Firebase token check: it answers ANY
 * signed-in user of this project, from any organization, whether or not they installed this extension.
 * And the organization arrives in the payload, because useCallable sends only what your screen passed —
 * so without the check, a user of one organization can point this at another.
 *
 * Pinned to ${region}: keep every function of an installation in one region.
 */
export const ${name} = onCall({ region: '${region}', cors: true }, async (request) => {
  const { tenantId } = (request.data ?? {}) as { tenantId?: string };
  const uid = await requireInstalledExtension('${pluginId}', String(tenantId ?? ''), request);

  return { ok: true, calledBy: uid };
});
`;

/**
 * Um gatilho de Firestore — e ele nasce com o portão de instalação, que não é enfeite.
 *
 * A Cloud Function é do PROJETO e a instalação da extensão é do ESCRITÓRIO: sem o portão, o gatilho
 * dispara também para quem nunca instalou a extensão, e para quem a desinstalou enquanto outro
 * escritório a mantém — caso em que a function nem pode ser removida, porque alguém ainda precisa dela.
 * Gerar o exemplo sem ele seria ensinar o defeito.
 */
export const triggerTs = (
  name: string,
  pluginId: string,
  collection: string,
  region: string,
): string =>
  `import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { forInstalledExtension } from 'microteia-functions/office';

/**
 * ${name}
 *
 * Runs when a document in "${collection}" is written — and only in the organizations that installed
 * this extension.
 *
 * forInstalledExtension is what limits it to them. A Cloud Function belongs to the PROJECT, while the
 * installation belongs to the ORGANIZATION, and nothing in Firebase reconciles the two: without it
 * this trigger also runs for organizations that never installed the extension, and for the one that
 * uninstalled it while another still has it. In that last case the function cannot be removed either
 * — somebody else still needs it — so the guard is the only thing that stops the side effect.
 *
 * Pinned to ${region}: a function in another region does not receive this project's Firestore triggers,
 * and nothing in the deploy tells you so.
 */
export const ${name} = onDocumentWritten(
  { document: 'tenants/{tenantId}/${collection}/{id}', region: '${region}' },
  forInstalledExtension('${pluginId}', async (event) => {
    const after = event.data?.after;
    if (!after?.exists) return;

    console.log('${name}', event.params.tenantId, event.params.id);
  }),
);
`;

/**
 * Uma function AGENDADA — e ela nasce com o laço por escritório, que não é enfeite.
 *
 * O evento de um agendado não carrega `{tenantId}`: não há escritório de onde perguntar, então o portão
 * de instalação não serve para ele. E ele falha FECHADO, o que significa que envolver um agendado nele o
 * deixaria inerte até enquanto a extensão está instalada. As duas saídas do autor eram erradas, e o laço
 * é a resposta: ele roda uma vez em cada escritório que instalou, e em nenhum outro.
 */
export const scheduleTs = (
  name: string,
  pluginId: string,
  schedule: string,
  region: string,
): string =>
  `import { onSchedule } from 'firebase-functions/v2/scheduler';
import { forEachInstalledOffice } from 'microteia-functions/office';

/**
 * ${name}
 *
 * Runs on a schedule — and once per organization that installed this extension, never in any other.
 *
 * forEachInstalledOffice is what limits it to them. A scheduled event carries no {tenantId}, so there is
 * no organization for forInstalledExtension to ask about: it fails closed, and wrapping a scheduled
 * function in it would leave the function inert even while your extension IS installed. Without a guard,
 * the run acts on the whole project — every organization, including the ones that never installed this.
 *
 * One organization failing does not take the others' turn: every installed organization runs, and the
 * function then fails naming the ones that did not.
 *
 * Pinned to ${region}: keep every function of an installation in one region.
 */
export const ${name} = onSchedule(
  { schedule: '${schedule}', region: '${region}' },
  async () => {
    const offices = await forEachInstalledOffice('${pluginId}', async (tenantId) => {
      console.log('${name}', tenantId);
    });

    console.log('${name} ran in', offices, 'organization(s)');
  },
);
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
    npx microteia-plugin build ${folderOf(spec.id)}/plugin.ts   # writes dist/${spec.id}.json

Import \`dist/${spec.id}.json\` on the **Extensions** screen.
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
  if (spec.view) {
    for (const [relative, content] of Object.entries(viewFiles(spec))) write(relative, content);
  }

  const result: ScaffoldResult = { directory, files };

  if (spec.functions) {
    const name = functionName(spec.id, 'hello');
    write(`functions/${name}.ts`, functionTs(name, spec.id, installationRegion(parentDir)));
    write('functions/index.ts', functionsIndexTs([name]));
    result.functionName = name;
  }

  return result;
};

/**
 * Acrescenta uma Cloud Function a uma extensão que já existe, atualizando o barril dela.
 *
 * `collection` escolhe a FORMA: sem ela, uma callable — que uma tela chama, e por isso já é inalcançável
 * quando a extensão sai. Com ela, um gatilho de gravação, que é o caso que precisa do portão.
 */
/**
 * O que dispara a function. É a pergunta que decide o molde, e as três respostas têm guardas diferentes:
 * a callable some com a tela que a chamava; o gatilho de documento pede o portão de instalação; e o
 * agendado, cujo evento não tem escritório, pede o laço por escritório.
 */
export type FunctionShape =
  | { kind: 'callable' }
  | { kind: 'trigger'; collection: string }
  | { kind: 'schedule'; schedule: string };

const sourceFor = (
  shape: FunctionShape,
  name: string,
  pluginId: string,
  region: string,
): string => {
  if (shape.kind === 'trigger') return triggerTs(name, pluginId, shape.collection, region);
  if (shape.kind === 'schedule') return scheduleTs(name, pluginId, shape.schedule, region);
  return functionTs(name, pluginId, region);
};

export const scaffoldFunction = (
  pluginDir: string,
  pluginId: string,
  action: string,
  region: string,
  shape: FunctionShape = { kind: 'callable' },
): string => {
  const name = functionName(pluginId, action);
  const functions = join(pluginDir, 'functions');
  const target = join(functions, `${name}.ts`);

  if (existsSync(target)) throw new Error(`${name} already exists in ${functions}.`);

  mkdirSync(functions, { recursive: true });
  writeFileSync(target, sourceFor(shape, name, pluginId, region));

  const index = join(functions, 'index.ts');
  const existing = existsSync(index)
    ? [...readFileSync(index, 'utf8').matchAll(/export \{ (\w+) \}/g)].map((match) => match[1])
    : [];
  writeFileSync(index, functionsIndexTs([...new Set([...existing, name])].sort()));

  return name;
};
