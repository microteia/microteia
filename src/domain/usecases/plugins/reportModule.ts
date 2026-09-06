import type { ReportDefinition, ReportModuleTemplate } from '../../entities/Report';
import type { ReportSpec } from '../../schema/report/reportSpec';

/**
 * Reescreve toda referência a COLEÇÃO dentro do spec para a chave INSTALADA.
 *
 * É a perna que resolve o sufixo: `buildScreenKeyMap` dá `produtos_2` quando `produtos` já está
 * ocupado no escritório de destino, e um relatório que continuasse apontando para `produtos` leria
 * uma coleção vazia — sem erro, sem aviso, e só no segundo escritório que instalasse duas extensões
 * com a mesma chave de tela.
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
  const { templateId, ...rest } = template;
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
