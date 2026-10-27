import type { MarketplacePlugin, TemplateField } from '../../entities/MarketplacePlugin';
import { DATA_EXTERNAL_LOOKUP_POINT, lookupProviderOf } from '../../schema/dataExtensionPoints';
import { LOOKUP_TARGET_MAP_SINCE_KERNEL } from '../../schema/fieldChangeSpec';
import { CORE_LOOKUP_PROVIDERS } from '../../schema/lookupProviderSpec';
import { rangeExcludesBelow } from '../../schema/plugin/semver';
import type { LocalizedIssue } from './pluginReferences';

const text = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;

const isWellFormedMap = (map: unknown): map is Record<string, string> =>
  !!map
  && typeof map === 'object'
  && !Array.isArray(map)
  && Object.keys(map).length > 0
  && Object.entries(map).every(([output, target]) => text(output) !== undefined && text(target) !== undefined);

/** Um campo cujo valor a plataforma escreve sozinha: o que a busca gravasse ali seria refeito. */
const isWrittenByPlatform = (field: TemplateField): boolean =>
  !!field.logic?.compute?.trim() || !!field.logic?.derive?.trim() || !!field.aggregation;

/**
 * As chaves que cada provedor deste pacote devolve. Provedor de dependência não está à vista daqui,
 * e a saída mapeada dele passa sem veredito.
 */
const providerOutputs = (pkg: MarketplacePlugin): Map<string, string[]> => {
  const declared = (pkg.manifest?.contributes ?? [])
    .filter((contribution) => contribution?.point === DATA_EXTERNAL_LOOKUP_POINT)
    .map(lookupProviderOf)
    .filter((spec) => spec !== undefined);
  return new Map([...CORE_LOOKUP_PROVIDERS, ...declared].map((spec) => [spec.key, Object.keys(spec.map)]));
};

interface FieldOwner {
  screen: string;
  fields: TemplateField[];
  /** Os campos são a tela INTEIRA? Num complemento, o destino pode ser campo da tela alvo, que daqui não se vê. */
  complete: boolean;
}

const fieldIssues = (owner: FieldOwner, field: TemplateField, outputs: Map<string, string[]>): LocalizedIssue[] => {
  const binding = field.logic?.onChangeLookup;
  if (!binding || binding.map === undefined || binding.map === null) return [];
  const where = { screen: owner.screen, field: field.key };

  if (!isWellFormedMap(binding.map)) {
    return [{ message: '@core.marketplace/issue.package.field.lookup.map-shape', messageParams: where }];
  }

  const prefix = text(binding.targetPrefix)
    ? [{ message: '@core.marketplace/issue.package.field.lookup.map-prefix', messageParams: where }]
    : [];

  const known = outputs.get(binding.provider);
  const entries = Object.entries(binding.map).map(([output, target]) => [output.trim(), target.trim()] as const);

  const unknownOutputs = known
    ? entries
      .filter(([output]) => !known.includes(output))
      .map(([output]): LocalizedIssue => ({
        message: '@core.marketplace/issue.package.field.lookup.map-output',
        messageParams: { ...where, provider: binding.provider, output, outputs: known.join(', ') },
      }))
    : [];

  const targets = entries.flatMap(([output, target]): LocalizedIssue[] => {
    if (target === field.key) {
      return [{ message: '@core.marketplace/issue.package.field.lookup.map-self', messageParams: { ...where, output } }];
    }
    const destination = owner.fields.find((candidate) => candidate.key === target);
    if (!destination) {
      return owner.complete
        ? [{ message: '@core.marketplace/issue.package.field.lookup.map-target', messageParams: { ...where, output, target } }]
        : [];
    }
    return isWrittenByPlatform(destination)
      ? [{ message: '@core.marketplace/issue.package.field.lookup.map-readonly', messageParams: { ...where, output, target } }]
      : [];
  });

  return [...prefix, ...unknownOutputs, ...targets];
};

/**
 * O destino de cada busca externa declarada com `map` (`logic.onChangeLookup`).
 *
 * Um destino errado não falha em lugar nenhum: a busca responde, o formulário descarta o que não tem
 * onde pôr, e o endereço simplesmente não aparece — o mesmo silêncio que o `map` existe para acabar.
 * Por isso é recusado aqui, e não ignorado lá.
 *
 * Só o `map` é conferido. O `targetPrefix` é o contrato de antes, e quem o usa instala como instalava.
 *
 * O `kernel` é de GARANTIA: um kernel anterior não conhece o `map` e gravaria as chaves cruas do
 * provedor (`street`, `city`) no registro.
 */
export const packageFieldLookupIssues = (pkg: MarketplacePlugin): LocalizedIssue[] => {
  const outputs = providerOutputs(pkg);
  const owners: FieldOwner[] = [
    ...(pkg.screens ?? []).map((screen) => ({ screen: screen.key, fields: screen.fields ?? [], complete: true })),
    ...(pkg.screenPatches ?? []).map((patch) => ({ screen: patch.target, fields: patch.fields ?? [], complete: false })),
  ];

  const issues = owners.flatMap((owner) => owner.fields.flatMap((field) => fieldIssues(owner, field, outputs)));

  const mapped = owners
    .flatMap((owner) => owner.fields.map((field) => ({ owner, field })))
    .find(({ field }) => isWellFormedMap(field.logic?.onChangeLookup?.map));
  const kernel = mapped && !rangeExcludesBelow(pkg.manifest?.kernel ?? '', LOOKUP_TARGET_MAP_SINCE_KERNEL)
    ? [{
      message: '@core.marketplace/issue.package.field.lookup.map-kernel',
      messageParams: { screen: mapped.owner.screen, field: mapped.field.key, minimum: LOOKUP_TARGET_MAP_SINCE_KERNEL },
    }]
    : [];

  return [...issues, ...kernel];
};
