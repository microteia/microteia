import type { WorkflowParameter, WorkflowParameterType } from './Workflow';

export interface ScriptOutputParam {
  key: string;
  label: string;
  type: WorkflowParameterType;
  list?: boolean;
  entityType?: string;
  lookupCollection?: string;
  fields?: ScriptOutputParam[];
}

export interface Script {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  sourceTs: string;
  compiledJs: string;
  inputParams: WorkflowParameter[];
  outputParams: ScriptOutputParam[];
  /**
   * O conjunto de extensões DONAS, e o id universal de origem. O motor sempre foi agnóstico a dono —
   * e continua sendo, para executar. Os dois chegam aqui porque a referência de uma extensão a um
   * artefato de OUTRA é resolvida por nome (`<pluginId>/<sourceId>`), e sem eles o backend não teria
   * como saber de quem é o script que o `sourceId` encontrou. Ver `artifactRef`.
   */
  ownerPluginIds?: string[] | null;
  sourceId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
