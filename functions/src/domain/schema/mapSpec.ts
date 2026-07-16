// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/mapSpec.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

import type { InputMapping } from '../entities/Workflow';

export interface MapFieldMapping {
  name: string;
  value: InputMapping;
}

export interface MapStepConfig {
  name?: string;
  type?: string;
  fields: MapFieldMapping[];
}
