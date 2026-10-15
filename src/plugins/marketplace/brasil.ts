import type { MarketplacePlugin } from '../../domain/entities/MarketplacePlugin';
import { fieldRulePresetContribution, lookupProviderContribution } from '../../domain/schema/dataExtensionPoints';
import type { FieldRulePreset } from '../../domain/schema/fieldRulePresets';
import type { LookupProviderSpec } from '../../domain/schema/lookupProviderSpec';

/**
 * **Brasil** — o que o kernel sabia sobre um país só, agora declarado por extensão.
 *
 * CPF, CNPJ, telefone e CEP são formatos do BRASIL: a máscara, o dígito verificador e a busca de
 * endereço por CEP não valem em lugar nenhum além daqui. Enquanto viviam no kernel, todo escritório
 * do mundo carregava a regra brasileira — e internacionalizar significaria empilhar o próximo país
 * ao lado, no mesmo código.
 *
 * Como extensão, cada escritório instala o país em que opera (ou nenhum), e um país novo é um pacote
 * novo, sem tocar no kernel. Quem consome declara a dependência: a extensão de Pessoas usa o CPF, o
 * CNPJ, o telefone e o CEP daqui.
 *
 * As CHAVES são as mesmas de antes (`cpf`, `cnpj`, `phone`, `cep`, `viacep`), então os campos já
 * gravados continuam válidos: muda quem responde pelo significado da chave, não a chave.
 */
/**
 * Os TEMPLATES das máscaras do país. `#` é dígito, e o motor genérico do kernel
 * (`applyMaskTemplate`) os aplica — ele não sabe o que é um CPF, só sabe preencher um template.
 * Vários templates na mesma máscara alternam pelo tamanho: telefone fixo e celular, CPF e CNPJ.
 */
export const CPF_TEMPLATE = '###.###.###-##';
export const CNPJ_TEMPLATE = '##.###.###/####-##';
export const PHONE_TEMPLATES = ['(##) ####-####', '(##) #####-####'];
export const CEP_TEMPLATE = '#####-###';
export const CNJ_TEMPLATE = '#######-##.####.#.##.####';

/**
 * Numeração única do CNJ (Res. 65/2008): NNNNNNN-DD.AAAA.J.TR.OOOO. O DD é ISO 7064 mod 97-10 sobre
 * o número com o DD levado para o FIM — por isso a expressão rearranja antes de chamar `mod97`, que
 * no kernel só sabe o resto. O tamanho vem primeiro porque `and` para no lado que decide.
 */
const CNJ_DIGITS = 'onlyNumber(value)';
const CNJ_CHECK =
  `length(${CNJ_DIGITS}) == 20 and ` +
  `mod97(concat(substring(${CNJ_DIGITS}, 0, 7), substring(${CNJ_DIGITS}, 9, 20), substring(${CNJ_DIGITS}, 7, 9))) == 1`;

/**
 * Os formatos do país. `mask` é o que o campo mostra enquanto se digita; `format`, o que fica
 * GRAVADO; `validate`, o que recusa o valor. `isCPF`/`isCNPJ` são funções do avaliador de
 * expressões, como `length` — é o único pedaço que ainda mora no runtime compartilhado.
 */
export const BR_FIELD_RULE_PRESETS: FieldRulePreset[] = [
  {
    key: 'cpf',
    label: 'CPF (000.000.000-00)',
    mask: { templates: [CPF_TEMPLATE], inputMode: 'numeric' },
    format: [{ op: 'digits' }, { op: 'mask', templates: [CPF_TEMPLATE] }],
    validate: { expression: 'isCPF(value)', message: 'CPF inválido' },
  },
  {
    key: 'cnpj',
    label: 'CNPJ (00.000.000/0000-00)',
    mask: { templates: [CNPJ_TEMPLATE], inputMode: 'numeric' },
    format: [{ op: 'digits' }, { op: 'mask', templates: [CNPJ_TEMPLATE] }],
    validate: { expression: 'isCNPJ(value)', message: 'CNPJ inválido' },
  },
  {
    key: 'cpfCnpj',
    label: 'CPF ou CNPJ',
    mask: { templates: [CPF_TEMPLATE, CNPJ_TEMPLATE], inputMode: 'numeric' },
    format: [{ op: 'digits' }, { op: 'mask', templates: [CPF_TEMPLATE, CNPJ_TEMPLATE] }],
    validate: { expression: 'isCPF(value) or isCNPJ(value)', message: 'CPF ou CNPJ inválido' },
  },
  {
    key: 'phone',
    label: 'Telefone ((00) 00000-0000)',
    mask: { templates: PHONE_TEMPLATES, placeholder: '(00) 00000-0000', inputMode: 'numeric' },
    format: [{ op: 'digits' }, { op: 'mask', templates: PHONE_TEMPLATES }],
  },
  {
    key: 'cep',
    label: 'CEP (00000-000)',
    mask: { templates: [CEP_TEMPLATE], inputMode: 'numeric' },
    format: [{ op: 'digits' }, { op: 'mask', templates: [CEP_TEMPLATE] }],
  },
  {
    key: 'cnj',
    label: 'Processo CNJ (0000000-00.0000.0.00.0000)',
    mask: { templates: [CNJ_TEMPLATE], inputMode: 'numeric' },
    format: [{ op: 'digits' }, { op: 'mask', templates: [CNJ_TEMPLATE] }],
    validate: { expression: CNJ_CHECK, message: 'Número de processo CNJ inválido' },
  },
];

const VIACEP: LookupProviderSpec = {
  key: 'viacep',
  label: 'Endereço pelo CEP (ViaCEP)',
  input: [{ op: 'digits' }],
  when: 'length(value) == 8',
  request: { url: 'https://viacep.com.br/ws/{value}/json/' },
  map: {
    street: 'logradouro',
    neighborhood: 'bairro',
    city: 'localidade',
    state: 'uf',
  },
  failWhen: { path: 'erro', message: 'CEP não encontrado' },
  errorMessage: 'Não foi possível consultar o CEP',
};

export const brasilPlugin: MarketplacePlugin = {
  manifest: {
    id: 'com.microteia.brasil',
    version: '1.2.0',
    kernel: '^2.44.0',
    name: 'Brasil',
    description: 'Documentos, telefone, CEP e busca de endereço do Brasil — as regras de país que o sistema não embute.',
    category: '@core.i18n/category.localization',
    publisher: { name: 'Microteia' },
    // Só declarações de dados: nenhuma tela, nenhuma automação, nenhum código.
    contributes: [
      ...BR_FIELD_RULE_PRESETS.map(fieldRulePresetContribution),
      lookupProviderContribution(VIACEP),
    ],
  },
  summary:
    'Traz CPF, CNPJ, telefone, CEP e número de processo CNJ com máscara e conferência automática, mais o preenchimento de endereço a partir do CEP. É a base brasileira que outras extensões usam nos seus cadastros.',
  overview: {
    type: 'stack',
    gap: 'lg',
    children: [
      {
        type: 'markdown',
        content:
          'A extensão **Brasil** ensina ao sistema os formatos daqui:\n\n- **CPF** e **CNPJ** com máscara e conferência do dígito verificador — documento inválido é recusado na digitação.\n- **Telefone** com DDD, fixo ou celular.\n- **CEP** com máscara.\n- **Número de processo CNJ** com máscara e conferência do dígito verificador.\n- **Endereço pelo CEP**: ao digitar o CEP, rua, bairro, cidade e estado se preenchem sozinhos.\n\nQualquer cadastro do escritório pode usar esses formatos nos seus campos — não só os que já vêm prontos.',
      },
      {
        type: 'keyValue',
        items: [
          { label: 'Formatos', value: 'CPF, CNPJ, CPF ou CNPJ, telefone, CEP, processo CNJ' },
          { label: 'Busca externa', value: 'Endereço pelo CEP (ViaCEP)' },
          { label: 'Usada por', value: 'Pessoas — e por qualquer tela que você criar' },
        ],
      },
      {
        type: 'banner',
        message: 'Sem esta extensão, os campos de CPF, CNPJ, telefone, CEP e processo CNJ continuam existindo e guardando o que já foi digitado — mas perdem a máscara, a conferência e o preenchimento pelo CEP.',
        variant: 'warning',
      },
    ],
  },
  workflows: [],
};
