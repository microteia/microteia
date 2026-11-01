import type { Firestore } from 'firebase-admin/firestore';
import type { Contribution, QualifiedContribution } from '../../domain/schema/plugin/contribution';
import { sortContributions } from '../../domain/schema/plugin/contribution';
import { DOCUMENT_TEMPLATE_POINT } from '../../domain/schema/document/documentTemplate';
import type { MessageBundle } from '../../domain/schema/i18n/messages';
import { messageBundlesOf } from '../../domain/schema/i18n/extensionPoints';
import { businessCalendarCollectionsOf } from '../../domain/schema/time/extensionPoints';
import { createHash } from 'node:crypto';
import { extensionCodeOf, isCodeTrusted } from '../../domain/schema/plugin/codeTrust';
import {
  portalPageSpecsOf,
  portalViewsOf,
  portalWidgetSpecsOf,
  type PortalPageSpecDescriptor,
  type PortalViewDescriptor,
  type PortalWidgetSpecDescriptor,
} from '../../domain/schema/portalExtensionPoints';
import { THEME_DEFINITION_POINT, THEME_TOKENS_POINT } from '../../domain/schema/theme/themePoints';
import {
  DATA_EXTERNAL_LOOKUP_POINT,
  DATA_FIELD_RULE_PRESET_POINT,
  fieldRulePresetOf,
  lookupProviderOf,
} from '../../domain/schema/dataExtensionPoints';
import type { FieldRulePreset } from '../../domain/schema/fieldRulePresets';
import type { LookupProviderSpec } from '../../domain/schema/lookupProviderSpec';

const THEME_POINTS = new Set([THEME_DEFINITION_POINT, THEME_TOKENS_POINT]);

interface CacheEntry {
  /** Os nomes de Cloud Function que as extensões LIGADAS deste escritório reivindicam. */
  claimedFunctions: Set<string>;
  /** As extensões instaladas e DESLIGADAS — as que o interruptor manda parar. */
  deactivatedPluginIds: Set<string>;
  messageBundles: MessageBundle[];
  /** As contribuições `document.template`, qualificadas e na ordem do registro. */
  documentTemplates: QualifiedContribution[];
  /** As coleções em que as extensões ligadas dizem guardar calendários de dias úteis. */
  businessCalendarCollections: string[];
  /** As views de portal das extensões ligadas cujo CÓDIGO o escritório confia. */
  portalViews: PortalViewDescriptor[];
  /** Os textos das extensões que trazem view de portal — o portal não lê o catálogo do escritório. */
  portalBundles: MessageBundle[];
  /** Os cartões da home DECLARADOS das extensões ligadas — não são código, e não pedem confiança. */
  portalWidgetSpecs: PortalWidgetSpecDescriptor[];
  /** As páginas do menu DECLARADAS das extensões ligadas — pela mesma régua dos cartões declarados. */
  portalPageSpecs: PortalPageSpecDescriptor[];
  /** As contribuições de tema das extensões ligadas, qualificadas e na ordem do registro. */
  themes: QualifiedContribution[];
  /** As máscaras, formatações e validações prontas que as extensões ligadas declaram. */
  fieldRulePresets: FieldRulePreset[];
  /** Os provedores de busca externa que as extensões ligadas declaram. */
  lookupProviders: LookupProviderSpec[];
  loadedAt: number;
}

const sha256 = (text: string): string => createHash('sha256').update(text).digest('hex');

const DEFAULT_TTL_MS = 5 * 60_000;

/**
 * O que as extensões instaladas declaram e o KERNEL precisa saber em execução.
 *
 * Duas perguntas, e as duas são respondidas pela mesma leitura de `installed_extensions` — que é o
 * motivo de elas morarem juntas, como em `ScreenDefinitionCache`.
 *
 * A primeira é a INVERSA da que `@microteia/office` responde, e a distinção é a razão de ser deste
 * arquivo. Uma function de extensão pergunta "a MINHA extensão está instalada?" e passa o próprio id
 * — é `isExtensionInstalled`. Uma function do KERNEL reivindicada por uma extensão não pode fazer
 * essa pergunta sem escrever o id do reivindicante dentro do núcleo, e um id de extensão escrito no
 * kernel é exatamente o defeito que este projeto existe para não ter.
 *
 * Então ela pergunta pelo NOME DELA MESMA: *alguma* extensão instalada e ativa reivindica esta
 * function? O kernel nomeia só o que é dele, a resposta continua sendo dado do escritório, e quem
 * bifurcar a extensão para um pacote próprio continua sendo atendido sem alterar o núcleo.
 */
export class InstalledExtensionCache {
  private readonly entries = new Map<string, CacheEntry>();

  constructor(
    private readonly db: Firestore,
    private readonly ttlMs = DEFAULT_TTL_MS,
  ) {}

  /**
   * O interruptor, e ele é imediato: desativar a extensão na aplicação faz a function deixar de
   * atender no fim do TTL, sem depender de ninguém rodar o Console para retirá-la do projeto.
   */
  async claimsFunction(tenantId: string, functionName: string): Promise<boolean> {
    return (await this.load(tenantId)).claimedFunctions.has(functionName);
  }

  /**
   * Os catálogos que as extensões contribuem, para o backend poder RESOLVER uma referência.
   *
   * O backend nunca formatou frase — devolve a referência e deixa a resolução para a tela, que tem o
   * catálogo de quem lê. Quem consome pelo gateway de agente não é uma tela, e é por isso que a
   * leitura passou a ser necessária deste lado.
   */
  async messageBundles(tenantId: string): Promise<MessageBundle[]> {
    return (await this.load(tenantId)).messageBundles;
  }

  /**
   * As extensões que o escritório desligou. É a pergunta do motor de automações: uma automação de
   * extensão materializada continua no escritório depois da desativação, e só a execução pode pará-la.
   */
  async deactivatedPluginIds(tenantId: string): Promise<ReadonlySet<string>> {
    return (await this.load(tenantId)).deactivatedPluginIds;
  }

  /**
   * Os modelos de documento que as extensões ligadas trazem, já na ordem do registro — prioridade,
   * depois `pluginId` —, que é a ordem em que `resolveDocumentTemplates` decide uma chave disputada. É
   * a mesma ordem que o host do front usa, e por isso o modelo que a tela oferece é o modelo gerado.
   */
  async documentTemplates(tenantId: string): Promise<QualifiedContribution[]> {
    return (await this.load(tenantId)).documentTemplates;
  }

  /**
   * Onde moram os calendários de dias úteis deste escritório (`time.business.calendar`). Vazio é
   * "nenhuma extensão ligada declara" — e a conta recusa, em vez de contar sem os dias não úteis.
   */
  async businessCalendarCollections(tenantId: string): Promise<string[]> {
    return (await this.load(tenantId)).businessCalendarCollections;
  }

  /**
   * As views de portal que o convidado pode receber, e os textos delas. Só de extensão LIGADA e com o
   * código confiável pela mesma régua da tela de Extensões (`isCodeTrusted`): a view roda no navegador
   * de quem é de fora, e o escritório não confiar no código é motivo de sobra para não mandá-lo.
   *
   * Os cartões e as páginas DECLARADOS (`widgets`, `pages`) vêm de toda extensão ligada: não rodam código,
   * e o texto deles é resolvido pelo servidor — não precisam dos `bundles`.
   */
  async portalViews(tenantId: string): Promise<{
    views: PortalViewDescriptor[];
    bundles: MessageBundle[];
    widgets: PortalWidgetSpecDescriptor[];
    pages: PortalPageSpecDescriptor[];
  }> {
    const entry = await this.load(tenantId);
    return {
      views: entry.portalViews,
      bundles: entry.portalBundles,
      widgets: entry.portalWidgetSpecs,
      pages: entry.portalPageSpecs,
    };
  }

  /**
   * Os temas instalados — definições e pacotes de tokens —, para o portal. O convidado não lê as
   * extensões instaladas, e sem isto o portal só oferecia os temas embutidos no bundle. Tema é
   * declaração de cor, não código: vale para toda extensão ligada, sem a régua de confiança das views.
   */
  async themes(tenantId: string): Promise<QualifiedContribution[]> {
    return (await this.load(tenantId)).themes;
  }

  /**
   * As máscaras e as buscas externas declaradas, para o formulário do portal. O convidado não lê as
   * extensões instaladas, e todas as máscaras e todos os provedores vêm de extensão: sem isto o portal
   * desenhava o CPF como texto comum e o CEP não preenchia nada. É declaração, não código — vale para
   * toda extensão ligada, como o tema.
   */
  async fieldInputCatalogs(tenantId: string): Promise<{ fieldRulePresets: FieldRulePreset[]; lookupProviders: LookupProviderSpec[] }> {
    const entry = await this.load(tenantId);
    return { fieldRulePresets: entry.fieldRulePresets, lookupProviders: entry.lookupProviders };
  }

  invalidate(tenantId: string): void {
    this.entries.delete(tenantId);
  }

  private async load(tenantId: string): Promise<CacheEntry> {
    const cached = this.entries.get(tenantId);
    if (cached && Date.now() - cached.loadedAt < this.ttlMs) return cached;

    const snapshot = await this.db.collection(`tenants/${tenantId}/installed_extensions`).get();

    const claimedFunctions = new Set<string>();
    const deactivatedPluginIds = new Set<string>();
    const contributions: Contribution[] = [];
    const documentTemplates: QualifiedContribution[] = [];
    const portalViews: PortalViewDescriptor[] = [];
    const portalBundleContributions: Contribution[] = [];
    const portalWidgetSpecs: PortalWidgetSpecDescriptor[] = [];
    const portalPageSpecs: PortalPageSpecDescriptor[] = [];
    const themes: QualifiedContribution[] = [];

    for (const doc of snapshot.docs) {
      const data = doc.data();
      // Extensão desativada conta como não instalada — a mesma frase que `isExtensionInstalled` diz,
      // e é ela que faz o interruptor ser um interruptor.
      if (data.active === false) {
        deactivatedPluginIds.add(doc.id);
        continue;
      }

      const claimed = data.package?.manifest?.backend?.functions;
      if (Array.isArray(claimed)) {
        for (const name of claimed) if (typeof name === 'string') claimedFunctions.add(name);
      }

      const contributes = data.package?.manifest?.contributes;
      if (Array.isArray(contributes)) {
        contributions.push(...(contributes as Contribution[]));
        for (const contribution of contributes as Contribution[]) {
          if (contribution?.point === DOCUMENT_TEMPLATE_POINT) documentTemplates.push({ ...contribution, pluginId: doc.id });
          if (THEME_POINTS.has(contribution?.point)) themes.push({ ...contribution, pluginId: doc.id });
        }

        portalWidgetSpecs.push(...portalWidgetSpecsOf(doc.id, contributes as Contribution[]));
        portalPageSpecs.push(...portalPageSpecsOf(doc.id, contributes as Contribution[]));

        const pkg = (data.package ?? {}) as { views?: Array<{ key: string; source: string }>; startup?: string };
        const code = extensionCodeOf(pkg);
        if (isCodeTrusted(data, code !== null, code === null ? null : sha256(code))) {
          const views = portalViewsOf(doc.id, contributes as Contribution[], Array.isArray(pkg.views) ? pkg.views : []);
          if (views.length > 0) {
            portalViews.push(...views);
            portalBundleContributions.push(...(contributes as Contribution[]));
          }
        }
      }
    }

    const entry: CacheEntry = {
      claimedFunctions,
      deactivatedPluginIds,
      messageBundles: messageBundlesOf(contributions),
      documentTemplates: sortContributions(documentTemplates),
      businessCalendarCollections: businessCalendarCollectionsOf(contributions),
      portalViews,
      portalBundles: messageBundlesOf(portalBundleContributions),
      portalWidgetSpecs,
      portalPageSpecs,
      themes: sortContributions(themes),
      fieldRulePresets: contributions
        .filter((contribution) => contribution?.point === DATA_FIELD_RULE_PRESET_POINT)
        .map(fieldRulePresetOf)
        .filter((preset): preset is FieldRulePreset => preset !== undefined),
      lookupProviders: contributions
        .filter((contribution) => contribution?.point === DATA_EXTERNAL_LOOKUP_POINT)
        .map(lookupProviderOf)
        .filter((provider): provider is LookupProviderSpec => provider !== undefined),
      loadedAt: Date.now(),
    };
    this.entries.set(tenantId, entry);
    return entry;
  }
}
