import type { LookupOption } from '../../domain/entities';

/**
 * Opções que já vêm prontas em cada lista do kernel. Antes viviam espalhadas como `DEFAULT_*` /
 * `STATIC_DEFAULTS` dentro dos ~30 repositórios de lookup; com o repositório único, o lugar delas é
 * aqui, indexadas pelo nome da coleção — a mesma chave que o campo usa em `lookupCollection`.
 *
 * São mescladas com as opções do tenant por `mergeLookupDefaults`, que descarta a duplicata: uma
 * opção do tenant com a mesma chave ou o mesmo rótulo de uma fixa não aparece duas vezes.
 */
const DECLARED: Record<string, Omit<LookupOption, 'isStatic'>[]> = {
  documentTypes: [
    { key: 'Contrato', label: 'Contrato' },
    { key: 'Procuração', label: 'Procuração' },
    { key: 'Petição', label: 'Petição' },
    { key: 'Sentença', label: 'Sentença' },
    { key: 'Certidão', label: 'Certidão' },
    { key: 'RG', label: 'RG' },
    { key: 'CPF', label: 'CPF' },
    { key: 'Comprovante', label: 'Comprovante' },
    { key: 'Recibo', label: 'Recibo' },
    { key: 'Outros', label: 'Outros' },
  ],
};

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
