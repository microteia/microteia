import type { MarketplacePlugin } from '../../entities/MarketplacePlugin';
import { getEntityByCollection } from '../../schema/entityRegistry';
import { isLookupCollection } from '../../schema/lookupRegistry';
import {
  SETTINGS_OPTIONS_SOURCE_KINDS,
  isMultiSelectProperty,
  validateSettingValue,
  type SettingsOptionsSource,
  type SettingsProperty,
} from '../../schema/settings';
import { UI_SETTINGS_POINT } from '../../schema/ui/uiExtensionPoints';
import type { LocalizedIssue, PackageRef } from './pluginReferences';

/** A origem da referência que nasce de uma propriedade de Configurações. */
export const SETTING_REF_ORIGIN = '@core.marketplace/ref.origin.setting';

interface DeclaredProperty {
  contributionId: string;
  where: string;
  property: Record<string, unknown>;
}

/**
 * As propriedades de Configurações que o pacote declara, com o caminho de cada uma no manifest. A
 * metadata chega solta (um `.json` de terceiro), então nada aqui supõe a forma além do mínimo.
 */
const declaredProperties = (pkg: MarketplacePlugin): DeclaredProperty[] =>
  (pkg.manifest?.contributes ?? []).flatMap((contribution, index) => {
    if (contribution?.point !== UI_SETTINGS_POINT) return [];
    const properties = contribution.metadata?.properties;
    if (!Array.isArray(properties)) return [];
    return properties.flatMap((property, position) =>
      typeof property === 'object' && property !== null
        ? [{
            contributionId: String(contribution.id),
            where: `contributes[${index}].metadata.properties[${position}]`,
            property: property as Record<string, unknown>,
          }]
        : []);
  });

/** `optionsFrom` bem formado, ou `null` — a forma malformada é recusada por `packageSettingsIssues`. */
const optionsSource = (property: Record<string, unknown>): SettingsOptionsSource | null => {
  const source = property.optionsFrom as Partial<SettingsOptionsSource> | undefined;
  if (typeof source !== 'object' || source === null) return null;
  if (!SETTINGS_OPTIONS_SOURCE_KINDS.includes(source.kind as SettingsOptionsSource['kind'])) return null;
  if (typeof source.collection !== 'string' || source.collection.trim() === '') return null;
  return { kind: source.kind as SettingsOptionsSource['kind'], collection: source.collection.trim() };
};

/**
 * O `default` de quem usa as capacidades novas do `select` precisa ter a forma que a resolução
 * devolve: um `string[]` quando `multi`, um texto quando não. A resolução nunca valida o `default` —
 * é o último nível —, então um padrão na forma errada chegaria à view de quem instalou como o valor
 * em vigor. Um único texto vazio é aceito no `select` simples de coleção: é "nada escolhido".
 *
 * O `select` de opções fechadas sem `multi` fica de fora de propósito. Esta checagem nasceu com
 * `optionsFrom` e `multi`, e recusar agora um pacote que já instalava seria mudar a regra de quem
 * não pediu nada.
 */
const defaultIssue = (declared: DeclaredProperty): LocalizedIssue | null => {
  const property = declared.property as unknown as SettingsProperty;
  if (property.type !== 'select' || (!property.optionsFrom && property.multi !== true)) return null;
  if (!isMultiSelectProperty(property) && property.optionsFrom && property.default === '') return null;
  const problem = validateSettingValue(property, property.default);
  if (!problem) return null;
  return {
    message: '@core.marketplace/issue.package.settings.default',
    messageParams: {
      id: declared.contributionId,
      key: String(property.key),
      where: `${declared.where}.default`,
      detail: `@core.settings/${problem.message}`,
      ...(problem.messageParams ?? {}),
    },
  };
};

const issue = (declared: DeclaredProperty, message: string, field: string): LocalizedIssue => ({
  message,
  messageParams: {
    id: declared.contributionId,
    key: String(declared.property.key),
    where: `${declared.where}.${field}`,
  },
});

/**
 * O que a declaração de uma propriedade não pode trazer, e que só o portão do pacote ainda deixa o
 * autor corrigir: `options` e `optionsFrom` juntas (qual das duas valeria?), `optionsFrom` ou `multi`
 * fora de um `select`, uma fonte que não diz de onde, e um `default` na forma errada.
 *
 * A coleção que não leva a lugar nenhum NÃO é conferida aqui: ela é uma referência, e passa pela
 * mesma porta das outras (`settingsOutRefs` → `validatePackage`), com a mesma frase.
 */
export const packageSettingsIssues = (pkg: MarketplacePlugin): LocalizedIssue[] =>
  declaredProperties(pkg).flatMap((declared) => {
    const { property } = declared;
    const issues: LocalizedIssue[] = [];
    const hasOptionsFrom = property.optionsFrom !== undefined;

    const refuse = (message: string, field: string): void => { issues.push(issue(declared, message, field)); };

    if (hasOptionsFrom && property.options !== undefined) {
      refuse('@core.marketplace/issue.package.settings.options-conflict', 'optionsFrom');
    }
    if (hasOptionsFrom && property.type !== 'select') {
      refuse('@core.marketplace/issue.package.settings.options-from-type', 'optionsFrom');
    }
    if (hasOptionsFrom && !optionsSource(property)) {
      refuse('@core.marketplace/issue.package.settings.options-from-invalid', 'optionsFrom');
    }
    if (property.multi !== undefined && property.type !== 'select') {
      refuse('@core.marketplace/issue.package.settings.multi-type', 'multi');
    }

    if (issues.length > 0) return issues;
    const invalidDefault = defaultIssue(declared);
    return invalidDefault ? [invalidDefault] : [];
  });

/**
 * As referências de saída das propriedades de Configurações: a coleção de onde vêm as opções.
 *
 * Entram em `packageOutRefs` e por isso passam pela mesma recusa das telas e dos relatórios — no
 * pacote ou numa dependência declarada. Uma entidade ou lista do KERNEL não vira referência: o nome é
 * global e não viaja com ninguém.
 */
export const settingsOutRefs = (pkg: MarketplacePlugin): PackageRef[] =>
  declaredProperties(pkg).flatMap(({ property }): PackageRef[] => {
    const source = optionsSource(property);
    if (!source || typeof property.key !== 'string') return [];
    const from = { origin: SETTING_REF_ORIGIN, name: property.key };
    if (source.kind === 'lookup') {
      return isLookupCollection(source.collection) ? [] : [{ kind: 'lookup', id: source.collection, from }];
    }
    return getEntityByCollection(source.collection) !== undefined || isLookupCollection(source.collection)
      ? []
      : [{ kind: 'screen', id: source.collection, from }];
  });
