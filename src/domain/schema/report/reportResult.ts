// ═══════════════════════════════════════════════════════════════════════════════
// FONTE ÚNICA — a cópia em functions/src/domain/schema/report/reportResult.ts é
// GERADA por scripts/sync-schemas.cjs (npm run sync-schemas). Nunca edite a cópia.
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * A chave de UM grupo, na dimensão que o produziu.
 *
 * `key` é a chave CRUA — a opção `pending`, o id do registro apontado, o balde `2026-03`. Ela nunca
 * chega traduzida: quem sabe transformar `pending` em "Pendente" é a listagem do escritório
 * (`useCustomFieldListing.displayValue`), e é ela que o relatório reusa, para que o cartão e o
 * relatório digam a mesma palavra sobre o mesmo dado.
 */
export interface ReportGroupKey {
  dimension: string;
  key: string;
  /** Rótulo bruto quando o backend o conhece (o balde de data). Ausente = o front resolve. */
  label?: string;
}

export interface ReportRow {
  /** As chaves dos níveis, do mais externo ao mais interno. */
  keys: ReportGroupKey[];
  /** `summary`: chave de medida → valor. */
  values: Record<string, number | null>;
  /** `matrix`: chave da coluna → chave de medida → valor. */
  cells?: Record<string, Record<string, number | null>>;
  /** Registros no grupo. Sempre presente: é grátis de calcular e é a pergunta mais comum. */
  count: number;
  /** Nível de agrupamento, para o recuo e o subtotal. */
  level: number;
  /** A linha é um SUBTOTAL do nível, não um grupo folha. */
  subtotal?: boolean;
  /**
   * Os REGISTROS deste grupo, na lista agrupada. Só no nível mais fundo.
   *
   * Moram na linha do grupo, e não numa lista à parte, porque quem sabe em que grupo cada registro
   * caiu é o agregador: refazer a conta na tela obrigaria a apresentação a repetir o corte de data e
   * o fuso da dimensão — duas implementações do mesmo balde, e a segunda erra sozinha no dia em que
   * a primeira mudar.
   */
  records?: Record<string, unknown>[];
}

export interface ReportTotals {
  values: Record<string, number | null>;
  count: number;
}

/**
 * O resultado, e o envelope que ADMITE O TETO.
 *
 * `complete` é enquadrado no positivo de propósito: o padrão de um campo esquecido não pode ser
 * "está tudo bem". Um relatório que varreu 2000 de 5000 registros e não diz que é parcial devolve um
 * número plausível e errado — a única falha que compromete o produto inteiro, porque nada na tela
 * denuncia. Por isso a incompletude aparece em TODA superfície: banner, cabeçalho do CSV, rodapé da
 * impressão.
 */
export interface ReportResult {
  shape: string;
  /** `matrix`: as colunas materializadas, na ordem. Cada uma é o caminho de chaves dos níveis. */
  columns: ReportGroupKey[][];
  rows: ReportRow[];
  totals: ReportTotals | null;
  /**
   * O total de cada COLUNA do pivô: chave da coluna → chave de medida → valor.
   *
   * Vem do servidor, e não de uma soma no cliente, porque somar as células exibidas daria o número
   * errado em toda medida que não é soma — a média das médias não é a média, e uma contagem
   * distinta somada conta duas vezes quem aparece em duas colunas.
   */
  columnTotals?: Record<string, Record<string, number | null>>;
  /** Só em `tabular`: os registros, já hidratados e projetados. */
  records?: Record<string, unknown>[];
  scanned: number;
  complete: boolean;
  /** Houve mais grupos ou colunas do que o teto de retorno. */
  completeGroups: boolean;
  /** Reservado para o executor paginado — ver "O executor vai mudar" no plano. */
  cursor?: string;
  generatedAt: string;
}
