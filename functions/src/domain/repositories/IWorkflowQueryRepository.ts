export interface WorkflowQueryRow {
  id: string;
  data: Record<string, unknown>;
}

export interface WorkflowEqualityFilter {
  path: string;
  value: unknown;
  /**
   * `array-contains` pergunta se a LISTA gravada contém o valor. Só a visibilidade por registro o usa,
   * e sempre SOZINHO numa consulta: ao lado de outro filtro, pediria um índice composto que uma coleção
   * nascida em tempo de execução não tem. Ausente = igualdade.
   */
  op?: '==' | 'array-contains';
}

/** Uma medida que o banco responde: contagem, soma ou média de um campo do documento. */
export interface WorkflowAggregateMeasure {
  key: string;
  op: 'count' | 'sum' | 'avg';
  path?: string;
}

export interface WorkflowAggregateResult {
  count: number;
  values: Record<string, number | null>;
}

export interface WorkflowQueryPage {
  after?: string;
}

export interface IWorkflowQueryRepository {
  /**
   * `page` pede a leitura em páginas: os documentos em ordem crescente de id, a partir do primeiro
   * DEPOIS de `page.after` (sem ele, do começo). É a ordem em que o banco já entrega uma consulta só de
   * igualdades, e por isso não pede índice composto. Ausente, a consulta é a de sempre.
   */
  queryByEquality: (
    tenantId: string,
    collection: string,
    equalityFilters: WorkflowEqualityFilter[],
    limit: number,
    page?: WorkflowQueryPage,
  ) => Promise<WorkflowQueryRow[]>;
  /**
   * A agregação feita PELO BANCO, com os mesmos filtros de igualdade, sobre todos os documentos que
   * atendem — sem varredura nem teto. Opcional: um repositório que não a tem deixa o total parcial.
   */
  aggregateByEquality?: (
    tenantId: string,
    collection: string,
    equalityFilters: WorkflowEqualityFilter[],
    measures: WorkflowAggregateMeasure[],
  ) => Promise<WorkflowAggregateResult>;
}
