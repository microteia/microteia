import type { WorkflowParameter, WorkflowParameterType } from './Workflow';
import type { WorkflowContentOrigin } from '../schema/workflowVersion';

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
  /** Dono PRIMÁRIO (= `ownerPluginIds[0]`) quando trazido por uma extensão. */
  ownerPluginId?: string | null;
  /** Conjunto de extensões que compartilham este script (refcount); removido só quando vazio. */
  ownerPluginIds?: string[] | null;
  /** Id UNIVERSAL de origem (GUID do artefato no tenant autor) — chave de deduplicação na instalação. */
  sourceId?: string | null;
  /** Revisão de ORIGEM do artefato, carimbada no empacotamento. A atualização da extensão DONA reescreve
   * o conteúdo, a não ser que a revisão que chega seja MENOR (reimportar um pacote antigo não regride);
   * outra extensão com o mesmo `sourceId` só o reescreve com revisão estritamente maior. */
  sourceRev?: number | null;
  /** De onde veio o conteúdo gravado por último — edição ou extensão. Ver `WorkflowContentOrigin`. */
  contentOrigin?: WorkflowContentOrigin;
  createdAt: Date;
  updatedAt: Date;
}
