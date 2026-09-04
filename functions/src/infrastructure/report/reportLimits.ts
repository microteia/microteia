/**
 * Os tetos do relatório.
 *
 * A varredura é maior que a do passo "Buscar Registros" (300) porque um total precisa ser um total:
 * somar as primeiras cem linhas e chamar isso de faturamento é a única falha deste desenho que o
 * leitor não tem como notar. E é POR ISSO que existe teto de qualquer forma — a estratégia
 * índice-free varre documento a documento, e o que não cabe é DITO, nunca escondido.
 */
export const REPORT_MAX_SCAN = 2000;

/** Teto de grupos devolvidos. Acima dele, `completeGroups` sai falso e a tela avisa. */
export const REPORT_MAX_GROUPS = 500;

/** Teto de colunas do pivô. Uma dimensão de coluna com 5000 valores derrubaria a tela. */
export const REPORT_MAX_COLUMNS = 50;

/** Teto de registros do relatório tabular. */
export const REPORT_MAX_RECORDS = 500;
