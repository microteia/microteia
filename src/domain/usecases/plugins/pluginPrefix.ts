import type { MarketplacePlugin } from '../../entities/MarketplacePlugin';
import type { LocalizedIssue } from './pluginReferences';
import { isLookupCollection } from '../../schema/lookupRegistry';
import { DOCUMENT_TEMPLATE_POINT } from '../../schema/document/documentTemplate';
import type { PrefixedNameKind } from '../../schema/plugin/artifactPrefix';
import { hasArtifactPrefix, isArtifactPrefix, prefixHead } from '../../schema/plugin/artifactPrefix';
import { reportTemplateSourceId } from './reportModule';

interface CreatedName {
  kind: PrefixedNameKind;
  name: string;
}

const metadataKey = (metadata: unknown): string | null => {
  const key = (metadata as { key?: unknown } | null)?.key;
  return typeof key === 'string' && key.trim() !== '' ? key.trim() : null;
};

/**
 * Todo nome que o pacote CRIA no escritório que o instala. Fica de fora o que ele só aponta: a
 * `dataCollection` de uma tela que descreve outra coleção, a lista de opções do kernel, o alvo de um
 * complemento — esses nomes são de outro dono.
 */
const createdNames = (pkg: MarketplacePlugin): CreatedName[] => [
  ...(pkg.screens ?? []).flatMap((screen): CreatedName[] => [
    { kind: 'collection', name: screen.key },
    ...(screen.eventPrefix ? [{ kind: 'collection' as const, name: screen.eventPrefix }] : []),
  ]),
  ...[...(pkg.lookups ?? []), ...(pkg.tagLists ?? [])]
    .filter((list) => !isLookupCollection(list.collection))
    .map((list): CreatedName => ({ kind: 'collection', name: list.collection })),
  ...(pkg.screenPatches ?? []).flatMap((patch) =>
    patch.fields.map((field): CreatedName => ({ kind: 'collection', name: field.key }))),
  ...[...pkg.workflows, ...(pkg.actions ?? []), ...(pkg.scripts ?? [])]
    .map((artifact): CreatedName => ({ kind: 'artifact', name: artifact.templateId })),
  ...(pkg.reports ?? []).map((report): CreatedName => ({ kind: 'artifact', name: reportTemplateSourceId(report) })),
  ...(pkg.manifest.contributes ?? [])
    .filter((contribution) => contribution?.point === DOCUMENT_TEMPLATE_POINT)
    .map((contribution) => metadataKey(contribution.metadata))
    .filter((key): key is string => key !== null)
    .map((key): CreatedName => ({ kind: 'artifact', name: key })),
];

/**
 * O prefixo DECLARADO é cobrado em todo nome que o pacote cria. Ausente, nada é cobrado: as extensões
 * publicadas antes do campo continuam instalando como sempre, e o `check` do SDK avisa da falta.
 *
 * Por que recusar, e não só avisar, quando o prefixo existe: o autor que o declarou disse que todo nome
 * dele começa assim. Um nome que escapa é o esquecimento que só aparece no escritório que já tem aquele
 * nome — e lá a instalação recusa, longe de quem poderia corrigir.
 */
export const packagePrefixIssues = (pkg: MarketplacePlugin): LocalizedIssue[] => {
  const prefix: unknown = pkg.manifest?.prefix;
  if (prefix === undefined) return [];
  if (!isArtifactPrefix(prefix)) {
    return [{ message: '@core.marketplace/issue.prefix.invalid', messageParams: { prefix: String(prefix) } }];
  }
  const seen = new Set<string>();
  return createdNames(pkg)
    .filter((one) => !hasArtifactPrefix(prefix, one.kind, one.name))
    .filter((one) => {
      const id = `${one.kind}:${one.name}`;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .map((one) => ({
      message: '@core.marketplace/issue.prefix.missing',
      messageParams: { name: one.name, head: prefixHead(prefix, one.kind) },
    }));
};

/** O pacote ainda sem prefixo — o que o `check` do SDK avisa, sem recusar. */
export const lacksPackagePrefix = (pkg: MarketplacePlugin): boolean =>
  pkg.manifest?.prefix === undefined && createdNames(pkg).length > 0;
