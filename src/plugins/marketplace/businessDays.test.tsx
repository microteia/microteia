// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { createPluginHost } from '../../kernel';
import { I18N_MESSAGES_POINT } from '../../domain/schema/i18n/extensionPoints';
import { CORE_PLUGINS } from '..';
import { extensionRecordFrom } from '../../domain/usecases/plugins/extensionRecordFrom';
import { materializePluginScreens } from '../../domain/usecases/plugins/screenModule';
import { evaluateExtensionView } from '../../presentation/shared/extensions/evaluateExtensionView';
import { UI_PAGE_POINT } from '../../domain/schema/ui/uiExtensionPoints';
import { BUSINESS_CALENDAR_POINT, businessCalendarCollectionsOf } from '../../domain/schema/time/extensionPoints';
import { BUSINESS_CALENDAR_FIELDS } from '../../domain/schema/time/businessDays';
import { calendarPlugin } from './calendar';
import { businessDaysPlugin } from './businessDays';

const loadHost = () => {
  const host = createPluginHost();
  const result = host.load([...CORE_PLUGINS, extensionRecordFrom(businessDaysPlugin, true)]);
  return { host, result };
};

describe('businessDaysPlugin', () => {
  it('carrega no host, com a página da grade, sem erros', () => {
    const { host, result } = loadHost();

    expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(host.isLoaded(businessDaysPlugin.manifest.id)).toBe(true);
    const pageKeys = host.contributions
      .query(UI_PAGE_POINT)
      .map((c) => (c.impl as { key?: string } | undefined)?.key);
    expect(pageKeys).toContain('business-days');
  });

  it('diz ao KERNEL onde moram os calendários — pelo ponto do kernel, sem o kernel escrever o nome', () => {
    const { host } = loadHost();
    const declared = businessCalendarCollectionsOf(host.contributions.query(BUSINESS_CALENDAR_POINT));
    const [{ input }] = materializePluginScreens(businessDaysPlugin, 'u1');

    expect(declared).toEqual([input.dataCollection]);
  });

  it('a tela guarda o contrato da conta: nome e chave única; ano e fim de semana ficam com a grade', () => {
    const [{ input }] = materializePluginScreens(businessDaysPlugin, 'u1');
    const keys = input.fields.map((field) => field.key);

    expect(keys).toEqual([BUSINESS_CALENDAR_FIELDS.name, BUSINESS_CALENDAR_FIELDS.key]);
    expect(input.keys).toMatchObject([
      { name: 'key', kind: 'unique', fields: [BUSINESS_CALENDAR_FIELDS.key], normalize: { caseInsensitive: true } },
    ]);
    expect(input.hideFromSidebar).toBe(true);
  });

  /**
   * Dias úteis servem a qualquer domínio com prazo. A declaração não pode citar coleção de negócio, e
   * NÃO depende da agenda: são coisas diferentes, e quem quiser juntar as duas consome o ponto.
   */
  it('não conhece entidade de negócio nem depende do Calendário', () => {
    const declaracao = JSON.stringify({
      screens: businessDaysPlugin.screens,
      manifest: {
        ...businessDaysPlugin.manifest,
        contributes: (businessDaysPlugin.manifest.contributes ?? [])
          .filter((contribution) => contribution.point !== I18N_MESSAGES_POINT),
      },
    });

    for (const colecao of ['deadlines', 'cases', 'persons', 'financials', 'contracts', 'pushes', 'calendar.']) {
      expect(declaracao, `dias úteis não pode conhecer "${colecao}"`).not.toContain(colecao);
    }
    expect(Object.keys(businessDaysPlugin.manifest.dependencies ?? {})).not.toContain(calendarPlugin.manifest.id);
  });

  it('a view compila e avalia contra a API curada', () => {
    const source = businessDaysPlugin.views?.find((view) => view.key === 'business-days')?.source ?? '';
    expect(evaluateExtensionView('com.microteia.business-days::business-days', source)).toBeTypeOf('function');
  });
});
