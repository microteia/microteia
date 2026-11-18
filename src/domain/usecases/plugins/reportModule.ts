import type { ReportDefinition, ReportModuleTemplate } from '../../entities/Report';
import type { MarketplacePlugin } from '../../entities/MarketplacePlugin';
import type { ReportSpec } from '../../schema/report/reportSpec';

/**
 * Reescreve toda referência a COLEÇÃO dentro do spec para a chave INSTALADA.
 *
 * É a perna que resolve a ADOÇÃO: quando o escritório já tem a tela de mesmo `sourceId` sob outra
 * chave (uma instalação antiga em `produtos_2`), `buildScreenKeyMap` devolve a chave dele, e um
 * relatório que continuasse apontando para `produtos` leria uma coleção vazia — sem erro e sem aviso.
 *
 * Anda pelo `dataset` inteiro em vez de cutucar `dataset.table` porque `joins` entrará por aqui, e um
 * reescritor que conhece um campo só envelhece na primeira adição.
 *
 * Nome FORA do mapa passa intacto: é a coleção do kernel (`persons`) ou a de uma dependência, e as
 * duas são nomes globais — a mesma leitura de `rewriteRef` e de `dataCollection`.
 *
 * Os CAMINHOS (`dimension.path`, `measure.path`) NÃO passam por aqui, e isso é decisão, não omissão:
 * um caminho nunca nomeia uma coleção. O hop de FK sai do `refEntity` do campo, que
 * `materializeScreen` já reescreveu — reescrever caminhos aqui seria corromper o que já está certo.
 */
export const rewriteReportTables = (spec: ReportSpec, keyMap: Map<string, string>): ReportSpec => {
  const table = keyMap.get(spec.dataset.table);
  return table === undefined || table === spec.dataset.table
    ? spec
    : { ...spec, dataset: { ...spec.dataset, table } };
};

export type ReportInput = Omit<ReportDefinition, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>;

const stripUndefined = <T>(value: T): T =>
  Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(([, one]) => one !== undefined),
  ) as T;

/**
 * O relatório do pacote na forma que o escritório grava.
 *
 * `managed: true` é o que torna o spec somente-leitura na autoria — um `ReportSpec` NÃO se mescla
 * com a edição do escritório, ao contrário de uma tela. Uma tela mescla porque o campo é unidade
 * independente com dono próprio; um relatório é uma afirmação só, e metade do pacote com metade do
 * escritório produziria um número que ninguém escreveu. O gesto é duplicar para editar.
 */
export const reportInputFromTemplate = (
  template: ReportModuleTemplate,
  pluginId: string,
  keyMap: Map<string, string>,
  userId?: string,
): ReportInput => {
  // `view` aponta para CÓDIGO do pacote e fica nele — ver `ReportModuleTemplate.view`.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- desestruturar para omitir `view` do documento
  const { templateId, view: _view, ...rest } = template;
  return stripUndefined({
    ...rest,
    spec: rewriteReportTables(template.spec, keyMap),
    origin: 'plugin',
    ownerPluginId: pluginId,
    ownerPluginIds: [pluginId],
    sourceId: template.sourceId ?? templateId,
    sourceRev: template.sourceRev ?? null,
    managed: true,
    enabled: template.enabled ?? true,
    createdBy: userId ?? null,
  }) as ReportInput;
};

/** Id UNIVERSAL do relatório: o `sourceId` do template; na falta, o próprio `templateId`. */
export const reportTemplateSourceId = (template: ReportModuleTemplate): string =>
  template.sourceId ?? template.templateId;

/**
 * O kernel a partir do qual `reports[].view` desenha o corpo da aba do relatório. Um kernel anterior
 * ignora a propriedade e mostra o corpo padrão — o relatório é o mesmo, só não tem a apresentação
 * escrita em código.
 */
export const REPORT_VIEW_SINCE_KERNEL = '2.138.0';

/** A view que desenha um relatório instalado: de quem é e qual, entre as `views` daquele pacote. */
export interface ReportCodeView {
  pluginId: string;
  viewKey: string;
}

/**
 * A view que o PACOTE dono declara para este relatório, ou `null` quando não há.
 *
 * Lê o pacote instalado, e não o documento do relatório: é lá que a declaração mora (ver
 * `ReportModuleTemplate.view`). O relatório do escritório (`design`) e o pessoal não têm pacote, e
 * por isso nunca trocam de corpo. Entre vários donos (o refcount de `ownerPluginIds`), vale o primeiro
 * que declara — a mesma ordem que elege `ownerPluginId`.
 *
 * Não decide se a view RODA: isso é da confiança de código, conferida por quem a resolve no registro de
 * implementações — onde ela só existe quando o pacote é confiado.
 */
export const reportCodeViewOf = (
  report: Pick<ReportDefinition, 'origin' | 'ownerPluginId' | 'ownerPluginIds' | 'sourceId' | 'ownerId'>,
  packageOf: (pluginId: string) => MarketplacePlugin | undefined,
): ReportCodeView | null => {
  if (report.origin !== 'plugin' || report.ownerId || !report.sourceId) return null;
  const owners = report.ownerPluginIds?.length ? report.ownerPluginIds : [report.ownerPluginId ?? ''];
  for (const pluginId of owners.filter((one) => one !== '')) {
    const pkg = packageOf(pluginId);
    const template = (pkg?.reports ?? []).find((one) => reportTemplateSourceId(one) === report.sourceId);
    const viewKey = typeof template?.view === 'string' ? template.view.trim() : '';
    if (viewKey !== '' && (pkg?.views ?? []).some((view) => view.key === viewKey)) return { pluginId, viewKey };
  }
  return null;
};
