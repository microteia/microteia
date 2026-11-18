import type { MarketplacePlugin } from '../../entities/MarketplacePlugin';
import { rangeExcludesBelow } from '../../schema/plugin/semver';
import { PORTAL_VIEW_POINT } from '../../schema/portalExtensionPoints';
import { getEntityByCollection } from '../../schema/entityRegistry';
import { isLookupCollection } from '../../schema/lookupRegistry';
import { isReportPeriod } from '../../schema/report/reportPeriod';
import {
  isWidgetSpec, widgetChildren, widgetDataFeatures, widgetFeatureSinceKernel, type WidgetFilter,
} from '../../schema/ui/widgetSpec';
import type { LocalizedIssue, PackageRef } from './pluginReferences';

/**
 * O `kernel` das telas em Widget DSL que LIGAM DADOS (`metric` com relatório, `report` com respostas
 * ou vista, a barra `filters`).
 *
 * É de garantia: um kernel anterior ignora o nó que não conhece — e a barra `filters` levaria com ela
 * o painel inteiro que está dentro dela, sem aviso. O cartão do portal fica de fora: ele tem o próprio
 * vocabulário (`portalWidget.ts`), conferido em `pluginPortal`.
 */
export const packageWidgetDataIssues = (pkg: MarketplacePlugin): LocalizedIssue[] => {
  const kernel = pkg.manifest?.kernel ?? '';
  return (pkg.manifest?.contributes ?? []).flatMap((contribution): LocalizedIssue[] => {
    if (contribution?.point === PORTAL_VIEW_POINT || contribution?.impl?.kind !== 'widget') return [];
    // A capacidade de dados cobra o kernel DELA: o filtro de escolha veio depois da barra, e um pacote
    // que admite o kernel da barra ainda pode admitir um que desenharia a escolha como caixa de texto.
    const feature = widgetDataFeatures(contribution.impl.spec)
      .find((one) => !rangeExcludesBelow(kernel, widgetFeatureSinceKernel(one)));
    return feature
      ? [{
        message: '@core.marketplace/issue.widget.data-kernel',
        messageParams: { contribution: contribution.id, feature, minimum: widgetFeatureSinceKernel(feature) },
      }]
      : [];
  });
};

export const WIDGET_REF_ORIGIN = '@core.marketplace/ref.origin.widget';

/** Os filtros de todas as barras de uma árvore, em qualquer profundidade. */
const filtersOf = (spec: unknown): WidgetFilter[] => {
  if (!isWidgetSpec(spec)) return [];
  const own = spec.type === 'filters' && Array.isArray(spec.filters) ? spec.filters : [];
  return [...own, ...widgetChildren(spec).flatMap(filtersOf)];
};

/**
 * O padrão de um filtro de PERÍODO da barra é um dos períodos.
 *
 * O relatório já confere o padrão dele (`validateReportSpec`); a barra não conferia, e o padrão
 * escrito errado só aparecia quando o servidor recusava o painel aberto — no escritório, não na
 * autoria (#4). Lista não é período: a barra pergunta um só.
 */
export const packageWidgetPeriodIssues = (pkg: MarketplacePlugin): LocalizedIssue[] =>
  (pkg.manifest?.contributes ?? []).flatMap((contribution): LocalizedIssue[] => {
    if (contribution?.point === PORTAL_VIEW_POINT || contribution?.impl?.kind !== 'widget') return [];
    return filtersOf(contribution.impl.spec)
      .filter((filter) => filter?.control === 'period'
        && filter.default !== undefined && filter.default !== '' && !isReportPeriod(filter.default))
      .map((filter) => ({
        message: '@core.marketplace/issue.widget.period-default',
        messageParams: { contribution: contribution.id, key: filter.key, value: String(filter.default) },
      }));
  });

/**
 * A coleção de onde um filtro de escolha da barra tira as opções. É referência como a de um campo
 * `reference` ou `select`: sem ela o painel viaja apontando para uma tela que o pacote não leva nem
 * declara em `dependencies`, e o escritório vê um seletor vazio sem nada dizer por quê.
 *
 * Entidade ou lista do KERNEL não vira referência: o nome é global e não viaja com ninguém.
 */
export const widgetOutRefs = (pkg: MarketplacePlugin): PackageRef[] =>
  (pkg.manifest?.contributes ?? []).flatMap((contribution): PackageRef[] => {
    if (contribution?.point === PORTAL_VIEW_POINT || contribution?.impl?.kind !== 'widget') return [];
    const from = { origin: WIDGET_REF_ORIGIN, name: contribution.id };
    return filtersOf(contribution.impl.spec).flatMap((filter): PackageRef[] => {
      const collection = typeof filter?.collection === 'string' ? filter.collection.trim() : '';
      if (collection === '' || isLookupCollection(collection)) return [];
      if (filter.control === 'lookup') return [{ kind: 'lookup', id: collection, from }];
      if (filter.control === 'record' && getEntityByCollection(collection) === undefined) {
        return [{ kind: 'screen', id: collection, from }];
      }
      return [];
    });
  });
