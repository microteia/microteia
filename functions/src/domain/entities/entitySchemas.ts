// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/entities/entitySchemas.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// FONTE ÚNICA — a cópia em functions/src/domain/entities/entitySchemas.ts é
// GERADA por scripts/sync-schemas.cjs (npm run sync-schemas). Nunca edite a cópia.
// ═══════════════════════════════════════════════════════════════════════════════

import { ENTITY_REGISTRY_LIST } from '../schema/entityRegistry';
import type {
  CustomFieldMask,
  CustomFieldOption,
  CustomFieldType,
  FieldAggregation,
  FieldLogic,
  FieldOrigin,
  FieldRules,
} from '../schema/fieldRules';

// ─── Tipos de Campos Customizados ─────────────────────────────────────────────

export type { CustomFieldType, CustomFieldMask, CustomFieldOption, FieldOrigin } from '../schema/fieldRules';

export type CustomFieldValue = string | string[] | number | boolean | null;

// ─── Definição de Campo ───────────────────────────────────────────────────────

export interface FieldDefinition {
  key: string;
  label: string;
  type: CustomFieldType;
  required: boolean;
  order: number;
  section?: string | null;
  options?: CustomFieldOption[];
  optionsAllowUserAdd?: boolean;
  optionsColored?: boolean;
  multi?: boolean;
  mask?: CustomFieldMask | null;
  refEntity?: string | null;
  lookupCollection?: string | null;
  placeholder?: string | null;
  showInList?: boolean;
  listLabel?: string | null;
  filterable?: boolean;
  rules?: FieldRules | null;
  logic?: FieldLogic | null;
  aggregation?: FieldAggregation | null;
  /**
   * Onde o campo foi declarado. `builtin` e `plugin` não podem ser EXCLUÍDOS pelo usuário; todas as
   * demais propriedades são livremente editáveis em qualquer origem.
   *
   * Um campo `builtin` só aparece em `fields[]` depois de editado pelo usuário: até lá ele vive
   * apenas em `entityRegistry.ts`, e o Form Design materializa a declaração INTEIRA no documento no
   * primeiro ajuste. A partir daí o documento é a verdade — como já acontece com `plugin` e
   * `design`. Ver `resolveScreenFields` em `schema/screenEntity.ts`.
   */
  origin: FieldOrigin;
  /** Esconde o campo do formulário sem excluí-lo — a alternativa para os campos não-excluíveis. */
  hiddenInForm?: boolean | null;
  /**
   * Presente quando o campo foi trazido por uma extensão (`origin: 'plugin'`): identifica QUAL
   * extensão, o que dirige o upgrade (substitui os do plugin, preserva os do usuário) e o refcount
   * de desinstalação.
   */
  ownerPluginId?: string | null;
}

// ─── Definição de Tela ────────────────────────────────────────────────────────

export type ScreenListAction = 'copyLink' | 'clone' | 'manageTags' | 'delete';

/**
 * Uma tela É uma entidade, e o seu `id` É o nome da coleção no Firestore:
 * `tenants/{tenantId}/{id}/{recordId}`, com os campos na raiz do documento. Vale igualmente para as
 * fixas (`persons`), as de extensão (`produtos`) e as do Form Design (`medico`) — a única
 * diferença entre elas é o `origin`.
 */
export interface ScreenDefinition {
  id: string;
  tenantId: string;
  /**
   * Onde a tela foi declarada. `builtin` e `plugin` não podem ser excluídas; o resto da configuração
   * (rótulos, ícone, ordem, abas, ações, campos adicionais) é livremente editável nas três.
   */
  origin: FieldOrigin;
  titleSingular: string;
  titlePlural: string;
  icon: string;
  fields: FieldDefinition[];
  titleFieldKey: string;
  hasNotes: boolean;
  hasDocuments: boolean;
  hasTags: boolean;
  /**
   * Coleção onde as etiquetas desta tela ficam. Duas telas que apontem para a mesma coleção
   * compartilham as etiquetas — é o mesmo mecanismo de `lookupCollection` num campo.
   */
  tagCollection?: string | null;
  listActions: ScreenListAction[];
  /** Ids de `ActionDefinition` exibidos no cabeçalho da tela de detalhe. */
  viewActionIds: string[];
  /** Ids de `ActionDefinition` exibidos no card da listagem. */
  cardActionIds: string[];
  /**
   * Quando presente, a tela é FILHA de outra: sai do menu lateral e da busca ⌘K, e seus registros
   * aparecem como uma aba do registro-pai. Aceita a chave de uma tela fixa ('cases', 'contracts'…)
   * ou o id de uma tela dinâmica.
   */
  parentEntity?: string | null;
  /** Campo `reference` desta tela que guarda o id do registro-pai. */
  parentFieldKey?: string | null;
  /**
   * Presente quando a tela foi trazida por uma extensão. `managed: true` a torna gerenciada: sua
   * estrutura é somente-leitura no Form Design (só a extensão altera/remove), embora o usuário
   * possa adicionar campos próprios por cima. A desinstalação da extensão remove as telas com este
   * `ownerPluginId`.
   */
  ownerPluginId?: string | null;
  /** Conjunto de extensões que compartilham esta tela (refcount); removida só quando vazio. */
  ownerPluginIds?: string[] | null;
  /** Id UNIVERSAL de origem da tela — GUID quando criada após a introdução do campo; senão a própria
   * chave (slug). É a base da chave instalada universal, o que deduplica telas entre extensões. */
  sourceId?: string | null;
  /** Revisão de ORIGEM (epoch ms do `updatedAt` no autor), carimbada no empacotamento. A atualização
   * só reescreve a estrutura quando a revisão que chega é estritamente maior que a materializada. */
  sourceRev?: number | null;
  managed?: boolean | null;
  /**
   * Mantém a tela FORA do menu lateral e da busca ⌘K mesmo sendo de topo (sem `parentEntity`). É o
   * que permite uma entidade existir sem menu quando quem dá acesso a ela é OUTRA tela — tipicamente
   * uma view de código de extensão que a apresenta com layout próprio. Diferente de `parentEntity`,
   * não a torna filha de ninguém: continua uma entidade de topo, só sem entrada de menu automática.
   */
  hideFromSidebar?: boolean | null;
  sidebarOrder: number;
  enabled: boolean;
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy?: string;
  updatedByName?: string;
  updatedByPhotoURL?: string;
  deletedBy?: string;
  deletedByName?: string;
  deletedByPhotoURL?: string;
}

// ─── Schema de Foreign Keys (derivado do ENTITY_REGISTRY) ─────────────────────

export interface FkFieldSpec {
  targetCollection: string;
  multi?: boolean;
  denormalizedFields?: string[];
}

const buildFkSchema = (): Record<string, Record<string, FkFieldSpec>> => {
  const schema: Record<string, Record<string, FkFieldSpec>> = {};
  for (const entity of ENTITY_REGISTRY_LIST) {
    if (entity.fks.length === 0) continue;
    const entitySchema: Record<string, FkFieldSpec> = {};
    for (const fk of entity.fks) {
      const spec: FkFieldSpec = { targetCollection: fk.targetCollection };
      if (fk.multi) spec.multi = true;
      if (fk.denormalizedFields) spec.denormalizedFields = fk.denormalizedFields;
      entitySchema[fk.key] = spec;
    }
    schema[entity.collection] = entitySchema;
  }
  return schema;
};

export const ENTITY_FK_SCHEMA: Record<string, Record<string, FkFieldSpec>> = buildFkSchema();

// ─── Coleções e Entidades (derivadas do ENTITY_REGISTRY) ──────────────────────

/** Entidades fixas que podem receber uma `ScreenDefinition` — as que aparecem no Form Design. */
export const CUSTOM_FIELD_ENABLED_ENTITIES = new Set(
  ENTITY_REGISTRY_LIST.filter((entity) => entity.supportsCustomFields).map((entity) => entity.collection),
);

export const BUILTIN_REF_ENTITIES = new Set(
  ENTITY_REGISTRY_LIST.filter((entity) => entity.referenceable).map((entity) => entity.collection),
);
