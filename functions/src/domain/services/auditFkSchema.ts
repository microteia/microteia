// ═══════════════════════════════════════════════════════════════════════════════
// DEPRECADO: Use entitySchemas.ts
// ═══════════════════════════════════════════════════════════════════════════════
// Este arquivo é mantido apenas para compatibilidade temporária.
// Migre para: import { ENTITY_FK_SCHEMA, ... } from '../entities/entitySchemas'
//
// Os exports abaixo são re-exports do entitySchemas para manter compatibilidade.
// ═══════════════════════════════════════════════════════════════════════════════

import type { FkFieldSpec } from '../entities/entitySchemas';
import {
  ENTITY_FK_SCHEMA,
  CUSTOM_FIELD_ENABLED_ENTITIES,
  BUILTIN_REF_ENTITIES,
  resolveRefEntityCollection,
} from '../entities/entitySchemas';

// Re-exports para compatibilidade
export type { FkFieldSpec };
export { CUSTOM_FIELD_ENABLED_ENTITIES, BUILTIN_REF_ENTITIES, resolveRefEntityCollection };

/**
 * @deprecated Use ENTITY_FK_SCHEMA de entitySchemas.ts
 */
export const STATIC_FK_SCHEMA = ENTITY_FK_SCHEMA;

// Aliases antigos para compatibilidade
export { CUSTOM_FIELD_ENABLED_ENTITIES as CUSTOM_FIELD_COLLECTIONS };

