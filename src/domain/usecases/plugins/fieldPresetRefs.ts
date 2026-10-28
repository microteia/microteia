import type { MarketplacePlugin, TemplateField } from '../../entities/MarketplacePlugin';
import type { Contribution } from '../../schema/plugin/contribution';
import { DATA_FIELD_RULE_PRESET_POINT, fieldRulePresetOf } from '../../schema/dataExtensionPoints';
import type { FieldRulePreset } from '../../schema/fieldRulePresets';
import { CORE_FIELD_RULE_PRESETS } from '../../schema/fieldRulePresets';
import type { LocalizedIssue } from './pluginReferences';

const KERNEL_PLUGIN_PREFIX = 'core.';

/** Quem responde pelos presets do núcleo — o dono do ponto `data.field.preset`. */
export const KERNEL_FIELD_PRESET_OWNER = 'core.data';

/**
 * O lugar do campo que nomeia um preset, e a parte do preset que ele usa: `mask` lê `preset.mask`,
 * `format` lê `preset.format`, `validate` lê `preset.validate`. Um preset que existe mas não tem a
 * parte pedida é tão inútil quanto um que não existe — o campo fica sem máscara do mesmo jeito.
 */
export type FieldPresetSlot = 'mask' | 'format' | 'validate';

export const FIELD_PRESET_SLOT_PATH: Record<FieldPresetSlot, string> = {
  mask: 'mask',
  format: 'rules.format.preset',
  validate: 'rules.validate.check',
};

/** O que um preset oferece, sem o conteúdo: a chave e as partes que ele declara. */
export interface OfferedFieldPreset {
  key: string;
  slots: FieldPresetSlot[];
}

/** Os presets que UMA extensão declara — o que outra extensão que a enxerga pode nomear. */
export interface FieldPresetOwner {
  pluginId: string;
  presets: OfferedFieldPreset[];
}

/** O mesmo critério dos seletores do editor de campo (`maskPresetOptions` e irmãos). */
export const fieldPresetSlots = (preset: FieldRulePreset): FieldPresetSlot[] => [
  ...(preset.mask ? ['mask' as const] : []),
  ...(preset.format?.length ? ['format' as const] : []),
  ...(preset.validate ? ['validate' as const] : []),
];

export const declaredFieldPresets = (contributes: Contribution[] | undefined): OfferedFieldPreset[] =>
  (contributes ?? [])
    .filter((contribution) => contribution?.point === DATA_FIELD_RULE_PRESET_POINT)
    .map(fieldRulePresetOf)
    .filter((preset): preset is FieldRulePreset => preset !== undefined)
    .map((preset) => ({ key: preset.key, slots: fieldPresetSlots(preset) }));

export const fieldPresetOwnerOf = (pkg: MarketplacePlugin): FieldPresetOwner => ({
  pluginId: pkg.manifest.id,
  presets: declaredFieldPresets(pkg.manifest.contributes),
});

const KERNEL_OWNER: FieldPresetOwner = {
  pluginId: KERNEL_FIELD_PRESET_OWNER,
  presets: CORE_FIELD_RULE_PRESETS.map((preset) => ({ key: preset.key, slots: fieldPresetSlots(preset) })),
};

/** Um campo do pacote que nomeia um preset. `screen` é a chave da tela, ou o alvo do complemento. */
export interface FieldPresetRef {
  screen: string;
  field: string;
  slot: FieldPresetSlot;
  key: string;
}

const text = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() !== '' ? value : undefined;

/**
 * `mask` só conta num campo `masked`: em qualquer outro tipo ele não é lido, e conferi-lo recusaria o
 * que não faz efeito nenhum. O `masked` SEM `mask` também fica de fora — o formulário tem um padrão
 * para ele, e quem o declarou assim instala como instalava.
 */
const refsOfField = (screen: string, field: TemplateField): FieldPresetRef[] => {
  const at = (slot: FieldPresetSlot, key: string | undefined): FieldPresetRef[] =>
    key === undefined ? [] : [{ screen, field: field.key, slot, key }];
  return [
    ...(field.type === 'masked' ? at('mask', text(field.mask)) : []),
    ...at('format', text(field.rules?.format?.preset)),
    ...at('validate', text(field.rules?.validate?.check)),
  ];
};

export const fieldPresetRefs = (pkg: MarketplacePlugin): FieldPresetRef[] => [
  ...(pkg.screens ?? []).flatMap((screen) => (screen.fields ?? []).flatMap((field) => refsOfField(screen.key, field))),
  ...(pkg.screenPatches ?? []).flatMap((patch) => (patch.fields ?? []).flatMap((field) => refsOfField(patch.target, field))),
];

/**
 * O veredito de UMA referência.
 *
 * - `ok`: o kernel, o pacote ou uma dependência declarada tem o preset, com a parte que o campo usa.
 * - `wrong-slot`: quem responde pela chave tem o preset, mas não a parte — `mask: 'digits'`. Recusa.
 * - `absent`: todas as dependências declaradas foram lidas e nenhuma tem a chave. Recusa: o pacote
 *   disse de onde os presets vêm, e lá não está.
 * - `undeclared`: só uma extensão que o pacote NÃO declara tem a chave. Funciona onde ela por acaso
 *   estiver instalada — aviso.
 * - `unverifiable`: alguma dependência declarada não está à vista. A chave pode morar nela — aviso.
 * - `no-provider`: ninguém visível tem a chave, e o pacote não declara dependência que pudesse ter.
 *   Aviso, nunca recusa: hoje esse campo instala e funciona no escritório que tem a extensão certa,
 *   e recusá-lo quebraria quem já depende disso sem ter declarado.
 */
export type FieldPresetVerdict = 'ok' | 'wrong-slot' | 'absent' | 'undeclared' | 'unverifiable' | 'no-provider';

export interface FieldPresetCheck {
  ref: FieldPresetRef;
  verdict: FieldPresetVerdict;
  /** Quem responde pela chave, quando alguém visível responde. */
  owner?: string;
  /** Uma chave visível que serve à mesma parte e só difere na grafia — `cpfCnpj` para `cpf-cnpj`. */
  suggestion?: string;
  /** As dependências declaradas que podem trazer presets (fora o kernel e o próprio pacote). */
  dependencies: string[];
  /** As que quem perguntou não enxerga. */
  unseen: string[];
}

const spelling = (key: string): string => key.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Confere cada preset que um campo do pacote nomeia (`mask`, `rules.format.preset`,
 * `rules.validate.check`) contra quem pode respondê-lo: o kernel, o próprio pacote e as extensões que
 * quem pergunta enxerga — na precedência do catálogo em runtime, em que a chave já ocupada não é
 * redefinida.
 *
 * Existe porque a resolução é tolerante de propósito: preset desconhecido é no-op na formatação e
 * aprovação na validação (`fieldRulePresets.ts`). É a tolerância certa para o registro — uma extensão
 * desinstalada não pode impedir ninguém de salvar —, e era ela que escondia o defeito: `mask:
 * 'cpf-cnpj'` contra o `cpfCnpj` da Brasil instalava e o campo ficava sem máscara, sem erro em lugar
 * nenhum.
 *
 * `visible` são as OUTRAS extensões que quem pergunta enxerga. A instalação não enxerga nenhuma, e por
 * isso só recusa o que o kernel e o pacote bastam para provar; o `check` do SDK enxerga as irmãs do
 * diretório e o retrato da instalação, e recusa também a chave que as dependências lidas não têm.
 */
export const fieldPresetChecks = (pkg: MarketplacePlugin, visible: FieldPresetOwner[] = []): FieldPresetCheck[] => {
  const refs = fieldPresetRefs(pkg);
  if (refs.length === 0) return [];

  const own = fieldPresetOwnerOf(pkg);
  const dependencies = Object.keys(pkg.manifest?.dependencies ?? {})
    .filter((id) => !id.startsWith(KERNEL_PLUGIN_PREFIX) && id !== own.pluginId);
  const others = visible.filter((owner) => owner.pluginId !== own.pluginId);
  const declared = dependencies.flatMap((id) => others.filter((owner) => owner.pluginId === id));
  const undeclared = others.filter((owner) => !dependencies.includes(owner.pluginId));
  const unseen = dependencies.filter((id) => !declared.some((owner) => owner.pluginId === id));
  const sources = [KERNEL_OWNER, own, ...declared, ...undeclared];

  const resolve = (key: string): { owner: FieldPresetOwner; preset: OfferedFieldPreset } | undefined => {
    for (const owner of sources) {
      const preset = owner.presets.find((candidate) => candidate.key === key);
      if (preset) return { owner, preset };
    }
    return undefined;
  };

  const suggest = (ref: FieldPresetRef): string | undefined => sources
    .flatMap((owner) => owner.presets)
    .find((preset) => preset.key !== ref.key && preset.slots.includes(ref.slot) && spelling(preset.key) === spelling(ref.key))
    ?.key;

  return refs.map((ref): FieldPresetCheck => {
    const head = { ref, dependencies, unseen };
    const found = resolve(ref.key);
    if (found) {
      const owner = found.owner.pluginId;
      if (!found.preset.slots.includes(ref.slot)) return { ...head, verdict: 'wrong-slot', owner };
      return { ...head, verdict: undeclared.includes(found.owner) ? 'undeclared' : 'ok', owner };
    }
    const suggestion = suggest(ref);
    const verdict: FieldPresetVerdict = unseen.length > 0 ? 'unverifiable' : dependencies.length > 0 ? 'absent' : 'no-provider';
    return { ...head, verdict, ...(suggestion === undefined ? {} : { suggestion }) };
  });
};

/** A recusa de UM veredito, ou `null` quando ele não é recusa. */
export const fieldPresetIssue = (check: FieldPresetCheck): LocalizedIssue | null => {
  const where = {
    screen: check.ref.screen,
    field: check.ref.field,
    preset: check.ref.key,
    path: FIELD_PRESET_SLOT_PATH[check.ref.slot],
    part: check.ref.slot,
  };
  if (check.verdict === 'wrong-slot') {
    return { message: '@core.marketplace/issue.package.field.preset.slot', messageParams: { ...where, owner: check.owner ?? '' } };
  }
  if (check.verdict !== 'absent') return null;
  const params = { ...where, dependencies: check.dependencies.join(', ') };
  return check.suggestion === undefined
    ? { message: '@core.marketplace/issue.package.field.preset.absent', messageParams: params }
    : { message: '@core.marketplace/issue.package.field.preset.absent.suggest', messageParams: { ...params, suggestion: check.suggestion } };
};

/** As RECUSAS — o que entra na porta única. Os vereditos de aviso ficam para quem tem relatório. */
export const fieldPresetIssues = (pkg: MarketplacePlugin, visible: FieldPresetOwner[] = []): LocalizedIssue[] =>
  fieldPresetChecks(pkg, visible).flatMap((check) => {
    const issue = fieldPresetIssue(check);
    return issue ? [issue] : [];
  });
