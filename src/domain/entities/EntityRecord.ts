import type { RecordWriteVia } from '../schema/mutationSpec';
import type { CustomFieldValue } from './entitySchemas';

/**
 * Um registro de QUALQUER entidade, lido de `tenants/{tenantId}/{collection}/{recordId}` com os
 * campos na raiz do documento. Vale para as telas fixas, as de extensão e as do Form Design — não
 * existe mais mapa `values` nem `customValues`.
 *
 * `tenantId` e `collection` são de MEMÓRIA: o repositório os preenche a partir do caminho lido e
 * nunca os grava, para que o documento contenha só os campos da tela.
 */
export interface RecordIdentity {
  id: string;
  tenantId: string;
  collection: string;
  /** Etiquetas aplicadas — campo gravado, declarado aqui só para não vir como `unknown`. */
  tagIds?: string[];
  createdAt: Date;
  createdBy: string;
  /**
   * Nome e foto de quem CRIOU, carimbados na criação como `updatedByName`/`updatedByPhotoURL` já
   * eram na gravação. Existem porque `createdBy` é um uid, e uma listagem que mostre o autor não tem
   * de onde tirar o nome: a lista de membros é outra coleção, e um registro velho pode ter sido
   * criado por quem já saiu do escritório.
   */
  createdByName?: string;
  createdByPhotoURL?: string;
  updatedAt: Date;
  updatedBy?: string;
  updatedByName?: string;
  updatedByPhotoURL?: string;
  /** Por onde a gravação entrou — `ui`, `agent` ou `automation`. Ausente nos registros anteriores ao campo. */
  createdVia?: RecordWriteVia;
  updatedVia?: RecordWriteVia;
}

export type EntityRecord = RecordIdentity & Record<string, unknown>;

/** Campos gravados no documento — o que o formulário produz, sem os metadados de identidade. */
export type EntityRecordValues = Record<string, CustomFieldValue | unknown>;

export interface RecordNote {
  id: string;
  recordId: string;
  collection: string;
  tenantId: string;
  title: string;
  text: string;
  createdBy: string;
  createdByName: string;
  createdByPhotoUrl?: string;
  createdAt: Date;
}

export interface RecordDocument {
  id: string;
  recordId: string;
  collection: string;
  tenantId: string;
  name: string;
  type?: string;
  description?: string;
  url: string;
  storagePath: string;
  createdBy: string;
  createdByName: string;
  createdByPhotoUrl?: string;
  createdAt: Date;
}

/** Etiqueta de uma tela, guardada em `screenDefinitions/{collection}/tags`. */
export interface ScreenTag {
  id: string;
  tenantId: string;
  screenKey: string;
  name: string;
  color: string;
  createdAt: Date;
  createdBy: string;
  createdByName?: string;
  createdByPhotoURL?: string;
}
