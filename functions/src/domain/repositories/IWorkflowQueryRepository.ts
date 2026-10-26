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

export interface IWorkflowQueryRepository {
  queryByEquality: (
    tenantId: string,
    collection: string,
    equalityFilters: WorkflowEqualityFilter[],
    limit: number,
  ) => Promise<WorkflowQueryRow[]>;
}
