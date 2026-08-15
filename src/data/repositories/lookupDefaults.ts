import type { LookupOption } from '../../domain/entities';

/**
 * Opções que já vêm prontas em cada lista do kernel. Antes viviam espalhadas como `DEFAULT_*` /
 * `STATIC_DEFAULTS` dentro dos ~30 repositórios de lookup; com o repositório único, o lugar delas é
 * aqui, indexadas pelo nome da coleção — a mesma chave que o campo usa em `lookupCollection`.
 *
 * São mescladas com as opções do tenant por `mergeLookupDefaults`, que descarta a duplicata: uma
 * opção do tenant com a mesma chave ou o mesmo rótulo de uma fixa não aparece duas vezes.
 */
/**
 * A `key` é o VALOR GRAVADO no registro do escritório, não texto de interface: traduzi-la mudaria o
 * dado de quem já a usa. Só o `label` traduz.
 */
/* eslint-disable no-restricted-syntax */
const DECLARED: Record<string, Omit<LookupOption, 'isStatic'>[]> = {
  documentTypes: [
    { key: 'Contrato', label: '@core.data/document-type.contrato' },
    { key: 'Procuração', label: '@core.data/document-type.procuracao' },
    { key: 'Petição', label: '@core.data/document-type.peticao' },
    { key: 'Sentença', label: '@core.data/document-type.sentenca' },
    { key: 'Certidão', label: '@core.data/document-type.certidao' },
    { key: 'RG', label: '@core.data/document-type.rg' },
    { key: 'CPF', label: '@core.data/document-type.cpf' },
    { key: 'Comprovante', label: '@core.data/document-type.comprovante' },
    { key: 'Recibo', label: '@core.data/document-type.recibo' },
    { key: 'Outros', label: '@core.data/document-type.outros' },
  ],
};
/* eslint-enable no-restricted-syntax */

/**
 * `isStatic` é carimbado aqui, e não na declaração acima: opção que vem em código É fixa, por
 * definição. Deixar a marca a cargo de cada entrada faria dela algo que se esquece — e esquecê-la
 * põe a opção do kernel entre as do escritório, com botão de excluir e sem a cor do tema.
 */
export const LOOKUP_DEFAULTS: Record<string, LookupOption[]> = Object.fromEntries(
  Object.entries(DECLARED).map(([collection, options]) => [
    collection,
    options.map((option) => ({ ...option, isStatic: true })),
  ]),
);

export const lookupDefaultsFor = (collection: string): LookupOption[] => LOOKUP_DEFAULTS[collection] ?? [];
