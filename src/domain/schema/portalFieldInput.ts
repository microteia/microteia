import type { FieldLookupBinding } from './fieldRules';
import type { FieldRulePresetCatalog, FieldRulePresetMask } from './fieldRulePresets';
import type { LookupProviderCatalog, LookupProviderSpec } from './lookupProviderSpec';
import { DEFAULT_LOOKUP_ERROR } from './lookupProviderSpec';

/**
 * A busca externa de um campo do portal: o provedor JÁ resolvido e o vínculo como o campo o declara.
 *
 * Vai a declaração inteira, e não a chave, porque o portal roda só com o kernel de boot: as extensões
 * do escritório — de onde vêm o ViaCEP e toda máscara — não chegam ao navegador do convidado. É dado
 * público do pacote (a URL não comporta chave de API), e a requisição sai do navegador pelo MESMO
 * executor do escritório (`makeDeclarativeLookupService`), com as mesmas garantias.
 */
export interface PortalFieldLookup {
  provider: LookupProviderSpec;
  binding: FieldLookupBinding;
}

/** O que o formulário do portal precisa para preencher um campo como o do escritório o preenche. */
export interface PortalFieldInput {
  /** O molde da máscara — o do preset que o campo `masked` declara, e não a chave dele. */
  mask?: FieldRulePresetMask;
  lookup?: PortalFieldLookup;
}

export interface PortalFieldInputSource {
  type?: string;
  mask?: string | null;
  onChangeLookup?: FieldLookupBinding | null;
}

export interface PortalFieldInputCatalogs {
  presets: FieldRulePresetCatalog;
  providers: LookupProviderCatalog;
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * O `logic.onChangeLookup` gravado na tela, só quando tem a forma mínima. Uma entrada estragada no
 * documento não pode derrubar o contexto do portal inteiro — vira campo sem busca, como era antes.
 */
export const asFieldLookupBinding = (value: unknown): FieldLookupBinding | undefined => {
  if (!isPlainObject(value) || typeof value.provider !== 'string' || value.provider.trim() === '') return undefined;
  const map = isPlainObject(value.map)
    ? Object.fromEntries(Object.entries(value.map).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
    : null;
  return {
    provider: value.provider,
    ...(map && Object.keys(map).length > 0 ? { map } : {}),
    ...(typeof value.targetPrefix === 'string' && value.targetPrefix.trim() !== '' ? { targetPrefix: value.targetPrefix } : {}),
  };
};

/**
 * Resolve, para UM campo preenchível do portal, a máscara e a busca externa no catálogo das extensões
 * LIGADAS do escritório. Chave que o catálogo não conhece não sai: o campo fica como sempre foi —
 * texto comum, sem busca —, e é isso que torna a resolução segura para quem não declara nada.
 *
 * As frases do provedor são resolvidas aqui, no idioma do convidado: a recusa "CEP não encontrado" é
 * texto da extensão, e o pacote de idioma dela não chega ao portal.
 */
export const portalFieldInput = (
  field: PortalFieldInputSource,
  catalogs: PortalFieldInputCatalogs,
  resolve: (value: string) => string,
): PortalFieldInput => {
  const mask = field.type === 'masked' && field.mask ? catalogs.presets.get(field.mask)?.mask : undefined;
  const binding = field.onChangeLookup ?? undefined;
  const provider = binding ? catalogs.providers.get(binding.provider) : undefined;
  return {
    ...(mask ? { mask } : {}),
    ...(binding && provider
      ? {
        lookup: {
          binding,
          provider: {
            ...provider,
            label: resolve(provider.label),
            errorMessage: resolve(provider.errorMessage ?? DEFAULT_LOOKUP_ERROR),
            ...(provider.failWhen ? { failWhen: { ...provider.failWhen, message: resolve(provider.failWhen.message) } } : {}),
          },
        },
      }
      : {}),
  };
};
