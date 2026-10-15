import { relative } from 'node:path';
import type { MarketplacePlugin } from '../../domain/entities/MarketplacePlugin';
import type { DeclaredNavGroup } from '../../domain/usecases/plugins/declaredNavGroups';
import {
  declaredNavGroupsOf,
  navGroupKeysJoinedBy,
  navGroupNameKey,
  navGroupNames,
} from '../../domain/usecases/plugins/declaredNavGroups';
import { CORE_UI_NAV_GROUPS } from '../../plugins/core.ui/navGroups';
import { buildPlugin } from './compile';
import { CORE_BUNDLES } from './messages';
import type { WorkspaceCatalog } from './workspaceCatalog';
import { readWorkspaceCatalog } from './workspaceCatalog';
import { findPluginFiles } from './workspacePlugins';

/**
 * OS GRUPOS DA BARRA LATERAL que este diretório enxerga — a lista que faltava para a chave de um grupo
 * ser DESCOBERTA em vez de inventada.
 *
 * A chave é universal: dois pacotes que declaram a mesma chave declaram UM grupo. O defeito que isto
 * fecha é o outro lado da mesma regra — duas chaves desenham dois grupos, mesmo com o mesmo nome.
 * Uma extensão do escritório declarou "Agenda" com chave própria, enquanto Calendário e Dias úteis já
 * declaravam `schedule`, também "Agenda" em pt-BR: o menu ganhou dois títulos iguais, e nada no
 * caminho de autoria tinha como avisar, porque nenhuma resposta listava os grupos que já existiam.
 *
 * Quatro fontes, e cada declaração diz de qual veio:
 *
 * - `platform` — os do núcleo (`CORE_UI_NAV_GROUPS`), presentes em toda instalação;
 * - `workspace` — os `plugin.ts` deste diretório;
 * - `installation` — as extensões do retrato (`installed-catalog.json`), quando há um;
 * - `example` — as extensões de primeira parte em `examples/`. Não estão instaladas por estarem ali,
 *   mas são as que mais provavelmente estão: a chave delas é a que o escritório reusa.
 */
export type NavGroupSource = 'platform' | 'workspace' | 'installation' | 'example';

export interface NavGroupDeclaration extends DeclaredNavGroup {
  from: NavGroupSource;
  pluginId: string;
  /** O arquivo, para `workspace` e `example`. */
  path?: string;
}

export interface VisibleNavGroups {
  declarations: NavGroupDeclaration[];
  /** `null` sem retrato; `false` quando o retrato veio de um Console que não registrava os grupos. */
  installationKnown: boolean | null;
  failures: { path: string; error: string }[];
}

const PLATFORM_PLUGIN_ID = 'core.ui';

export const visibleNavGroups = (root: string, read: WorkspaceCatalog = readWorkspaceCatalog(root)): VisibleNavGroups => {
  const declarations: NavGroupDeclaration[] = declaredNavGroupsOf(CORE_UI_NAV_GROUPS, CORE_BUNDLES)
    .map((group) => ({ ...group, from: 'platform', pluginId: PLATFORM_PLUGIN_ID }));
  const failures = [...read.failures];

  for (const authored of read.authored) {
    for (const group of authored.navGroups ?? []) {
      declarations.push({ ...group, from: 'workspace', pluginId: authored.pluginId, path: authored.path });
    }
  }

  for (const extension of read.installed?.extensions ?? []) {
    for (const group of extension.navGroups ?? []) {
      declarations.push({ ...group, from: 'installation', pluginId: extension.id });
    }
  }

  for (const entry of findPluginFiles(root).examples) {
    try {
      const { package: pkg } = buildPlugin({ entry });
      for (const group of declaredNavGroupsOf(pkg.manifest.contributes)) {
        declarations.push({ ...group, from: 'example', pluginId: pkg.manifest.id, path: relative(root, entry) });
      }
    } catch (error) {
      failures.push({ path: relative(root, entry), error: error instanceof Error ? error.message : String(error) });
    }
  }

  return {
    declarations,
    installationKnown: read.installed === null ? null : read.installed.navGroupsKnown,
    failures,
  };
};

export interface NavGroupSummary {
  key: string;
  label: string;
  order: number;
  names: string[];
  declaredBy: { from: NavGroupSource; pluginId: string; path?: string; label: string; order: number }[];
}

/** Uma linha por CHAVE, com quem a declara — o que o autor escreve em `group:` é a chave. */
export const summarizeNavGroups = (declarations: readonly NavGroupDeclaration[]): NavGroupSummary[] => {
  const byKey = new Map<string, NavGroupDeclaration[]>();
  for (const one of declarations) byKey.set(one.key, [...(byKey.get(one.key) ?? []), one]);

  return [...byKey.entries()]
    .map(([key, all]) => ({
      key,
      label: all[0].label,
      order: all[0].order,
      names: [...new Set(all.flatMap((one) => [one.label, ...Object.values(one.translations)]))],
      declaredBy: all.map((one) => ({
        from: one.from,
        pluginId: one.pluginId,
        ...(one.path === undefined ? {} : { path: one.path }),
        label: one.label,
        order: one.order,
      })),
    }))
    .sort((a, b) => a.order - b.order || (a.key < b.key ? -1 : 1));
};

/** Os nomes que aparecem em MAIS DE UMA chave — cada um é um título repetido no menu de quem tem as duas. */
export const sameNameDifferentKeys = (
  declarations: readonly NavGroupDeclaration[],
): { name: string; keys: string[] }[] => {
  const keysByName = new Map<string, { name: string; keys: Set<string> }>();
  for (const one of declarations) {
    for (const name of [one.label, ...Object.values(one.translations)]) {
      const normalized = navGroupNameKey(name);
      if (normalized === '') continue;
      const entry = keysByName.get(normalized) ?? { name, keys: new Set<string>() };
      entry.keys.add(one.key);
      keysByName.set(normalized, entry);
    }
  }
  return [...keysByName.values()]
    .filter((one) => one.keys.size > 1)
    .map((one) => ({ name: one.name, keys: [...one.keys].sort() }));
};

export type NavGroupFindingStatus = 'same-name' | 'undeclared';

export interface NavGroupFinding {
  status: NavGroupFindingStatus;
  key: string;
  detail: string;
}

const describeDeclarer = (one: NavGroupDeclaration): string =>
  one.from === 'platform' ? 'the platform' : `${one.pluginId} (${one.from})`;

/**
 * O que o `check` e o `validate_plugin` AVISAM sobre os grupos do pacote. Nunca recusa: o escritório
 * pode ter outra extensão que este diretório não enxerga, e dois grupos com o mesmo nome podem ser
 * intenção.
 *
 * - `same-name`: o pacote declara uma chave que ninguém mais declara, com um nome que outro grupo
 *   visível já tem. Onde os dois estiverem instalados, o menu mostra o mesmo título duas vezes.
 * - `undeclared`: um item entra num grupo que nenhuma fonte visível declara. Instalado assim, ele fica
 *   solto no menu.
 */
export const navGroupFindings = (pkg: MarketplacePlugin, visible: VisibleNavGroups): NavGroupFinding[] => {
  const own = declaredNavGroupsOf(pkg.manifest.contributes);
  const others = visible.declarations.filter((one) => one.pluginId !== pkg.manifest.id);
  const otherKeys = new Set(others.map((one) => one.key));
  const findings: NavGroupFinding[] = [];

  for (const group of own) {
    if (otherKeys.has(group.key)) continue;
    const names = new Set(navGroupNames(group));
    const clashing = others.filter((one) => one.key !== group.key && navGroupNames(one).some((name) => names.has(name)));
    if (clashing.length === 0) continue;
    const target = clashing[0];
    const shared = [group.label, ...Object.values(group.translations)]
      .find((name) => navGroupNames(target).includes(navGroupNameKey(name))) ?? group.label;
    findings.push({
      status: 'same-name',
      key: group.key,
      detail: `"${shared}" is already the name of group "${target.key}", declared by `
        + `${[...new Set(clashing.filter((one) => one.key === target.key).map(describeDeclarer))].join(', ')}. `
        + 'A group is joined by KEY, never by name: where both are installed, the sidebar shows two groups '
        + `with the same title. To join it, declare key "${target.key}" instead.`,
    });
  }

  const ownKeys = new Set(own.map((one) => one.key));
  for (const key of navGroupKeysJoinedBy(pkg.manifest.contributes)) {
    if (ownKeys.has(key) || otherKeys.has(key)) continue;
    findings.push({
      status: 'undeclared',
      key,
      detail: 'no group with this key is visible here — not in this package, the platform, this directory, '
        + 'the examples or the installation snapshot. Unless an installed extension declares it, the menu '
        + 'entry stands loose. Read microteia://nav-groups for the keys that exist.',
    });
  }

  return findings;
};

/**
 * O relatório, a partir do diretório. O catálogo só é lido quando o pacote declara grupo ou põe item
 * em grupo: conferir um pacote sem menu não paga o preço de compilar todo `plugin.ts`.
 */
export const navGroupReport = (pkg: MarketplacePlugin, root: string): NavGroupFinding[] =>
  declaredNavGroupsOf(pkg.manifest.contributes).length > 0 || navGroupKeysJoinedBy(pkg.manifest.contributes).length > 0
    ? navGroupFindings(pkg, visibleNavGroups(root))
    : [];
