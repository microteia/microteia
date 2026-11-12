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
  /** Revisão de ORIGEM (epoch ms do `updatedAt` no autor), carimbada no empacotamento. A atualização
   * só reescreve o conteúdo quando a revisão que chega é estritamente maior que a materializada. */
  sourceRev?: number | null;
  /** De onde veio o conteúdo gravado por último — edição ou extensão. Ver `WorkflowContentOrigin`. */
  contentOrigin?: WorkflowContentOrigin;
  createdAt: Date;
  updatedAt: Date;
}
