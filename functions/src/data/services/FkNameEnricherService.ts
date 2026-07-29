import type { Firestore } from 'firebase-admin/firestore';
import type { AuditFieldDiff, IFkNameEnricherService } from '../../domain/repositories/IFkNameEnricherService';
import type { EntityData } from '../../domain/services/auditDiff';
import { ENTITY_FK_SCHEMA, type FkFieldSpec } from '../../domain/entities/entitySchemas';
import { getFlatEntityConfig } from '../../domain/services/auditableEntities';

interface EntityRef {
  collection: string;
  id: string;
}

export class FkNameEnricherService implements IFkNameEnricherService {
  constructor(private readonly db: Firestore) {}

  /**
   * Campos `reference` que a tela do tenant declara para a coleção — indexados pela própria chave,
   * porque moram na raiz do documento como qualquer outro campo.
   */
  private async getDynamicFkSchema(tenantId: string, collection: string): Promise<Record<string, FkFieldSpec>> {
    const snap = await this.db.doc(`tenants/${tenantId}/screenDefinitions/${collection}`).get();
    if (!snap.exists) return {};

    const fields = (snap.data()?.fields as Array<Record<string, unknown>>) ?? [];
    const schema: Record<string, FkFieldSpec> = {};
    for (const field of fields) {
      if (field.type !== 'reference' || !field.refEntity) continue;
      schema[field.key as string] = {
        targetCollection: field.refEntity as string,
        multi: field.multi === true,
      };
    }
    return schema;
  }

  async enrichDiff(tenantId: string, collection: string, screenKey: string | undefined, diff: AuditFieldDiff): Promise<AuditFieldDiff> {
    void screenKey;
    const dynamicSchema = await this.getDynamicFkSchema(tenantId, collection);
    const schema = { ...ENTITY_FK_SCHEMA[collection], ...dynamicSchema };
    if (Object.keys(schema).length === 0) return diff;

    const refs = new Map<string, EntityRef>();
    const collectRefs = (data?: EntityData) => {
      if (!data) return;
      for (const [key, spec] of Object.entries(schema)) {
        const value = data[key];
        if (value == null) continue;
        for (const id of Array.isArray(value) ? value : [value]) {
          if (typeof id === 'string' && id) refs.set(`${spec.targetCollection}:${id}`, { collection: spec.targetCollection, id });
        }
      }
    };
    collectRefs(diff.before);
    collectRefs(diff.after);
    if (refs.size === 0) return diff;

    const uniqueRefs = [...refs.values()];
    const snapshots = await this.db.getAll(...uniqueRefs.map((ref) => this.db.doc(`tenants/${tenantId}/${ref.collection}/${ref.id}`)));

    const nameByRef = new Map<string, string>();
    snapshots.forEach((snap, i) => {
      if (!snap.exists) return;
      const ref = uniqueRefs[i];
      const name = getFlatEntityConfig(ref.collection)?.getDisplayName(snap.data() as EntityData);
      if (name) nameByRef.set(`${ref.collection}:${ref.id}`, name);
    });

    const applyNames = (data?: EntityData): EntityData | undefined => {
      if (!data) return data;
      const out: EntityData = { ...data };
      for (const [key, spec] of Object.entries(schema)) {
        const value = data[key];
        if (value == null) continue;
        out[key] = Array.isArray(value)
          ? value.map((id) => (typeof id === 'string' ? nameByRef.get(`${spec.targetCollection}:${id}`) ?? id : id))
          : (typeof value === 'string' ? nameByRef.get(`${spec.targetCollection}:${value}`) ?? value : value);
      }
      return out;
    };

    return { before: applyNames(diff.before), after: applyNames(diff.after) };
  }
}
