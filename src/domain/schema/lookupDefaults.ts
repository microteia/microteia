/**
 * As opções que já vêm prontas em cada lista do kernel, indexadas pelo nome da coleção — a mesma
 * chave que o campo usa em `lookupCollection`.
 *
 * Mora no schema COMPARTILHADO, e não só na camada de dados do front, porque o backend também precisa
 * dela: o agente que anexa um documento confere o tipo contra a lista que a tela oferece, e uma lista
 * sem as opções fixas recusaria "Procuração" num escritório que nunca cadastrou tipo nenhum.
 *
 * Estas opções NÃO passam pelo catálogo do núcleo, e é de propósito. "Tipo de documento" é conceito do
 * kernel — qualquer tela pode ter documentos —, mas Procuração, Petição e Certidão são vocabulário de
 * um domínio, não do produto. Traduzi-las aqui seria o kernel assumindo a tradução de algo que não é
 * dele: quem declara o vocabulário é que responde por ele. O escritório renomeia cada opção quando
 * quiser, e uma extensão pode declarar as suas.
 */
export interface DeclaredLookupOption {
  key: string;
  label: string;
}

/* eslint-disable no-restricted-syntax -- vocabulário de domínio, fora do escopo do núcleo (ver acima) */
export const DECLARED_LOOKUP_OPTIONS: Readonly<Record<string, readonly DeclaredLookupOption[]>> = {
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
/* eslint-enable no-restricted-syntax */

/**
 * NÃO ordena: ordenar alfabeticamente exige o rótulo TRADUZIDO e a regra de colação do idioma, e
 * nada disso existe aqui. A ordem alfabética é aplicada no `LookupStore`, que já resolve as
 * referências. Aqui fica só a mescla, na ordem "fixas primeiro, depois as do escritório" — e a
 * duplicata é descartada: uma opção do escritório com a mesma chave ou o mesmo rótulo de uma fixa
 * não aparece duas vezes.
 */
export const mergeLookupDefaults = <T extends DeclaredLookupOption>(statics: T[], dynamic: T[]): T[] => {
  const reserved = new Set<string>(statics.flatMap((item) => [item.key, item.label]));
  const uniqueDynamic = dynamic.filter((item) => !reserved.has(item.key) && !reserved.has(item.label));
  return [...statics, ...uniqueDynamic];
};
