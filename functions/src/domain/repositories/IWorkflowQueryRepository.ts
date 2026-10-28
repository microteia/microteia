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
}
