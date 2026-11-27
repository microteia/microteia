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
  /** Revisão de ORIGEM do artefato, carimbada no empacotamento. Só arbitra entre extensões DIFERENTES
   * com o mesmo `sourceId`: a outra só o reescreve com revisão estritamente maior. Ver `contentPluginId`. */
  sourceRev?: number | null;
  /** A extensão cujo pacote gravou o conteúdo atual. Quando é ela que reinstala, o conteúdo converge para o
   * pacote em qualquer direção — é o que faz a volta pelo histórico voltar de fato (#40). `ownerPluginId`
   * não serve: é quem instalou primeiro, e não muda quando outra extensão reescreve o artefato. */
  contentPluginId?: string | null;
  /** De onde veio o conteúdo gravado por último — edição ou extensão. Ver `WorkflowContentOrigin`. */
  contentOrigin?: WorkflowContentOrigin;
  createdAt: Date;
  updatedAt: Date;
}
