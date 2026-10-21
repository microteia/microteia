import type { MarketplacePlugin, TemplateField } from '../../entities/MarketplacePlugin';
import { AGGREGATION_ORDER_SYSTEM_KEYS } from '../../schema/aggregationSpec';
import type { DocumentTemplateDataset } from '../../schema/document/documentTemplate';
import {
  DOCUMENT_DATASET_ORDER_LIST_SINCE_KERNEL,
  DOCUMENT_TEMPLATE_POINT,
  datasetOrder,
  datasetOrderIssues,
  usesDatasetOrderList,
} from '../../schema/document/documentTemplate';
import { rangeExcludesBelow } from '../../schema/plugin/semver';
import type { LocalizedIssue } from './pluginReferences';

interface DeclaredDataset {
  template: string;
  dataset: DocumentTemplateDataset;
}

const declaredDatasets = (pkg: MarketplacePlugin): DeclaredDataset[] =>
  (pkg.manifest.contributes ?? [])
    .filter((contribution) => contribution?.point === DOCUMENT_TEMPLATE_POINT)
    .flatMap((contribution) => {
      const metadata = contribution.metadata as { key?: unknown; datasets?: unknown } | undefined;
      const template = typeof metadata?.key === 'string' ? metadata.key : String(contribution.id ?? '');
      const datasets = Array.isArray(metadata?.datasets) ? metadata.datasets : [];
      return datasets
        .filter((dataset): dataset is DocumentTemplateDataset => typeof dataset === 'object' && dataset !== null)
        .map((dataset) => ({ template, dataset }));
    });

/** Os campos da tela dos filhos, quando ela vem no PRÓPRIO pacote — pelo `sourceId`, como a instalação a endereça. */
const packagedFields = (pkg: MarketplacePlugin, dataset: DocumentTemplateDataset): TemplateField[] | null => {
  const screens = pkg.screens ?? [];
  const screen = dataset.fromSourceId
    ? screens.find((one) => one.sourceId === dataset.fromSourceId)
    : screens.find((one) => one.key === dataset.from);
  if (!screen) return null;
  const patched = (pkg.screenPatches ?? [])
    .filter((patch) => patch.target === screen.key || (screen.sourceId !== undefined && patch.target === screen.sourceId))
    .flatMap((patch) => patch.fields);
  return [...screen.fields, ...patched];
};

/**
 * A ordem dos datasets dos modelos de documento do pacote: a forma, os campos e o `kernel`.
 *
 * O campo só é conferido quando a tela dos filhos vem no próprio pacote — a de uma dependência ou a do
 * escritório não está aqui para ser lida, e recusar o que não se pode ver recusaria um pacote certo. É
 * a mesma regra do `orderBy` do `latest` (`packageAggregationIssues`), e pelo mesmo motivo: uma chave
 * que não existe não falha ao instalar, falha ao gerar, no escritório do cliente.
 *
 * A checagem do `kernel` é o que faz um kernel ANTIGO recusar o pacote: ele leria a lista como o nome
 * de um campo, e o documento deixaria de sair sem nada dizer por quê.
 */
export const packageDocumentTemplateIssues = (pkg: MarketplacePlugin): LocalizedIssue[] => {
  const datasets = declaredDatasets(pkg);

  const shape = datasets.flatMap(({ template, dataset }) =>
    datasetOrderIssues(dataset, '').map((issue): LocalizedIssue => ({
      message: '@core.marketplace/issue.document.order.invalid',
      messageParams: { ...(issue.errorParams ?? {}), template, list: String(dataset.name ?? ''), detail: issue.error },
    })));

  const unknown = datasets.flatMap(({ template, dataset }) => {
    const fields = packagedFields(pkg, dataset);
    if (!fields) return [];
    const keys = new Set([...fields.map((field) => field.key), ...AGGREGATION_ORDER_SYSTEM_KEYS]);
    return datasetOrder(dataset)
      .filter((order) => order.path !== '' && !keys.has(order.path.split('.')[0]))
      .map((order): LocalizedIssue => ({
        message: '@core.marketplace/issue.document.order.unknown',
        messageParams: { template, list: String(dataset.name ?? ''), path: order.path },
      }));
  });

  const listed = datasets.find(({ dataset }) => usesDatasetOrderList(dataset));
  const kernel = listed && !rangeExcludesBelow(pkg.manifest.kernel ?? '', DOCUMENT_DATASET_ORDER_LIST_SINCE_KERNEL)
    ? [{
        message: '@core.marketplace/issue.document.order.kernel',
        messageParams: {
          template: listed.template,
          list: String(listed.dataset.name ?? ''),
          minimum: DOCUMENT_DATASET_ORDER_LIST_SINCE_KERNEL,
        },
      }]
    : [];

  return [...shape, ...unknown, ...kernel];
};
