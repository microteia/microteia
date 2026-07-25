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
  FieldRules,
} from '../schema/fieldRules';

// ─── Tipos de Campos Customizados ─────────────────────────────────────────────

export type { CustomFieldType, CustomFieldMask, CustomFieldOption } from '../schema/fieldRules';

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
   * Presente quando o campo foi trazido por uma extensão. É somente-leitura no Form Design (o
   * usuário não edita nem exclui) e distingue os campos do plugin dos que o usuário adicionou por
   * cima — o upgrade da extensão substitui os do plugin e preserva os do usuário.
   */
  ownerPluginId?: string | null;
}

// ─── Override de campo nativo ─────────────────────────────────────────────────

/**
 * Ajustes por tenant sobre um campo FIXO (declarado em `entityRegistry.ts`), feitos pelo Form
 * Design. Cobre **apenas o que só o front lê** — apresentação e as expressões front-only.
 *
 * Tipo, máscara, `rules` (formato/validação), `logic.validate`, `logic.compute` e `required`
 * ficam de fora de propósito: o backend também os lê, e um override que ele não enxergasse faria
 * um workflow gravar registro que a tela rejeita. Ver "Override de campo fixo" no ARCHITECTURE.
 */
export interface NativeFieldOverride {
  label?: string | null;
  placeholder?: string | null;
  section?: string | null;
  order?: number | null;
  hiddenInForm?: boolean | null;
  logic?: Pick<FieldLogic, 'hiddenWhen' | 'disabledWhen' | 'onChange' | 'onChangeLookup'> | null;
}

// ─── Definição de Tela ────────────────────────────────────────────────────────

export type ScreenListAction = 'copyLink' | 'clone' | 'manageTags' | 'delete';

export interface ScreenDefinition {
  id: string;
  tenantId: string;
  builtin: boolean;
  titleSingular: string;
  titlePlural: string;
  icon: string;
  fields: FieldDefinition[];
  /** Só nas telas fixas: ajustes sobre os campos declarados em código, por chave. */
  nativeFieldOverrides?: Record<string, NativeFieldOverride> | null;
  /**
   * Marca que fixos e adicionais já compartilham o mesmo espaço de ordenação. Enquanto for falso,
   * os adicionais são exibidos depois dos fixos — o layout que existia antes da unificação.
   */
  fieldOrderUnified?: boolean | null;
  titleFieldKey: string;
  hasNotes: boolean;
  hasDocuments: boolean;
  hasTags: boolean;
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

export const CUSTOM_FIELD_ENABLED_ENTITIES = new Set(
  ENTITY_REGISTRY_LIST.filter((entity) => entity.supportsCustomFields).map((entity) => entity.collection),
);

export const BUILTIN_REF_ENTITIES = new Set(
  ENTITY_REGISTRY_LIST.filter((entity) => entity.referenceable).map((entity) => entity.collection),
);

/**
 * Resolve a coleção de destino para um refEntity.
 * Se for uma entidade builtin, retorna o nome da coleção.
 * Caso contrário, retorna 'customRecords' (para telas customizadas).
 */
export const resolveRefEntityCollection = (refEntity: string): string =>
  BUILTIN_REF_ENTITIES.has(refEntity) ? refEntity : 'customRecords';
