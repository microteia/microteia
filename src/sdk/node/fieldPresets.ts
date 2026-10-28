import type { MarketplacePlugin } from '../../domain/entities/MarketplacePlugin';
import type { FieldPresetCheck, FieldPresetOwner } from '../../domain/usecases/plugins/fieldPresetRefs';
import {
  FIELD_PRESET_SLOT_PATH,
  KERNEL_FIELD_PRESET_OWNER,
  fieldPresetChecks,
  fieldPresetIssue,
} from '../../domain/usecases/plugins/fieldPresetRefs';
import { INSTALLED_CATALOG_FILE } from './installedCatalog';
import { describeMessage } from './messages';
import type { WorkspaceCatalog } from './workspaceCatalog';
import { readWorkspaceCatalog } from './workspaceCatalog';

/**
 * O preset que um campo nomeia e que só ESTE diretório pode responder: o que não é do kernel nem do
 * próprio pacote.
 *
 * O portão do pacote (`fieldPresetIssues`) não enxerga outra extensão, e por isso não diz nada sobre
 * `mask: 'cpf-cnpj'` num pacote que depende da Brasil — a chave pode morar nela. Aqui há duas fontes,
 * na precedência de sempre: os `plugin.ts` deste diretório e o retrato da instalação.
 *
 * - `ok`: uma dependência declarada tem o preset, com a parte que o campo usa.
 * - `refused`: as dependências declaradas foram lidas e nenhuma tem a chave, ou quem a tem não declara
 *   a parte que o campo usa. A instalação aceitaria, e o campo perderia a máscara sem aviso.
 * - `undeclared`: a chave existe, mas numa extensão que o pacote não declara em `dependencies`.
 * - `unverifiable`: ninguém visível tem a chave, e não dá para dizer que ela não existe — alguma
 *   dependência não está à vista, ou o pacote não declara nenhuma.
 *
 * Só `refused` reprova. Os outros dois são ditos: o campo funciona hoje no escritório que tem a extensão
 * certa instalada, e recusar o que não se viu ensinaria o autor a ignorar a recusa.
 */
export type FieldPresetStatus = 'ok' | 'refused' | 'undeclared' | 'unverifiable';

export interface FieldPresetFinding {
  preset: string;
  /** `<tela>.<campo>`, com o lugar do campo que nomeia o preset. */
  field: string;
  path: string;
  status: FieldPresetStatus;
  detail: string;
}

/** O que o portão já responde sozinho não se repete aqui: sai como problema, ou não é problema. */
const needsWorkspace = (check: FieldPresetCheck): boolean =>
  check.verdict === 'unverifiable' || check.verdict === 'no-provider';

/** Workspace primeiro: é o pacote em edição, e é dele que sairá a próxima versão instalada. */
const visibleOwners = (pkg: MarketplacePlugin, read: WorkspaceCatalog): { owners: FieldPresetOwner[]; where: Map<string, string> } => {
  const owners: FieldPresetOwner[] = [];
  const where = new Map<string, string>([[KERNEL_FIELD_PRESET_OWNER, 'the kernel']]);

  for (const one of read.authored) {
    if (one.pluginId === pkg.manifest.id || one.fieldPresets === undefined) continue;
    owners.push({ pluginId: one.pluginId, presets: one.fieldPresets });
    where.set(one.pluginId, `the plugin.ts of ${one.pluginId} in this workspace`);
  }

  const snapshot = read.installed;
  for (const one of snapshot?.extensions ?? []) {
    if (one.id === pkg.manifest.id || where.has(one.id) || one.fieldPresets === undefined) continue;
    owners.push({ pluginId: one.id, presets: one.fieldPresets });
    where.set(one.id, `${INSTALLED_CATALOG_FILE}, taken ${snapshot?.ageDays ?? '?'} day(s) ago`);
  }
  return { owners, where };
};

const REFRESH = (tenantId: string): string =>
  `Run "microteia export-catalog --tenant ${tenantId}" in the installation`;

export const fieldPresetFindings = (pkg: MarketplacePlugin, read: WorkspaceCatalog): FieldPresetFinding[] => {
  const { owners, where } = visibleOwners(pkg, read);
  const withWorkspace = fieldPresetChecks(pkg, owners);
  const snapshot = read.installed;
  const silent = (snapshot?.extensions ?? []).filter((one) => one.fieldPresets === undefined).map((one) => one.id);

  return fieldPresetChecks(pkg)
    .map((alone, index) => ({ alone, here: withWorkspace[index] }))
    .filter(({ alone }) => needsWorkspace(alone))
    .map(({ here }): FieldPresetFinding => {
      const head = {
        preset: here.ref.key,
        field: `${here.ref.screen}.${here.ref.field}`,
        path: FIELD_PRESET_SLOT_PATH[here.ref.slot],
      };
      const from = here.owner === undefined ? '' : where.get(here.owner) ?? here.owner;
      const meant = here.suggestion === undefined ? '' : ` Did you mean "${here.suggestion}"?`;

      const issue = fieldPresetIssue(here);
      if (issue !== null) {
        const source = here.verdict === 'absent'
          ? ` Read ${here.dependencies.map((id) => `${id} from ${where.get(id) ?? id}`).join('; ')}.`
          : ` Read from ${from}.`;
        return { ...head, status: 'refused', detail: `${describeMessage(issue.message, issue.messageParams)}${source}` };
      }
      if (here.verdict === 'ok') {
        return { ...head, status: 'ok', detail: `${here.owner} declares it, according to ${from}.` };
      }
      if (here.verdict === 'undeclared') {
        return {
          ...head,
          status: 'undeclared',
          detail: `${here.owner} declares it, according to ${from}, but this package does not list ${here.owner} in `
            + 'dependencies. The field gets it only where that extension happens to be installed; elsewhere it '
            + 'silently goes without. Declare the dependency.',
        };
      }

      const older = silent.length === 0
        ? ''
        : ` ${INSTALLED_CATALOG_FILE} does not record the field presets of ${silent.join(', ')} — it was taken by a `
          + `Console older than that field. ${REFRESH(snapshot?.tenantId ?? '<tenantId>')} with the Console that came with it.`;
      const why = here.verdict === 'unverifiable'
        ? `${here.unseen.join(', ')} is not authored in this workspace nor recorded in `
          + `${snapshot === null ? `an ${INSTALLED_CATALOG_FILE} (there is none here)` : INSTALLED_CATALOG_FILE}, so it `
          + 'cannot be checked here'
        : 'nothing visible declares it, and this package declares no dependency that could. It works only where '
          + 'an extension declaring it happens to be installed: declare that extension in dependencies';
      return {
        ...head,
        status: 'unverifiable',
        detail: `${why}. If the key is a typo, the field silently goes without its preset.${meant}${older}`,
      };
    });
};

/**
 * O relatório, a partir do diretório. O catálogo só é lido quando há preset que dependa dele: conferir
 * um pacote cujos campos o kernel e ele mesmo respondem não paga o preço de compilar todo `plugin.ts`.
 */
export const fieldPresetReport = (pkg: MarketplacePlugin, root: string): FieldPresetFinding[] =>
  fieldPresetChecks(pkg).some(needsWorkspace) ? fieldPresetFindings(pkg, readWorkspaceCatalog(root)) : [];
