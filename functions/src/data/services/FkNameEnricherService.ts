import type { Firestore } from 'firebase-admin/firestore';
import type { AuditFieldDiff, IFkNameEnricherService } from '../../domain/repositories/IFkNameEnricherService';
import type { IScreenDefinitionProvider } from '../../domain/repositories/IScreenDefinitionProvider';
import type { SchemaContext } from '../../domain/schema/pathResolver';
import type { EntityData } from '../../domain/services/auditDiff';
import { ENTITY_FK_SCHEMA, type FkFieldSpec } from '../../domain/entities/entitySchemas';
import { resolveEntity } from '../../domain/schema/screenEntity';
import { getFlatEntityConfig } from '../../domain/services/auditableEntities';

interface EntityRef {
  collection: string;
  id: string;
}

export class FkNameEnricherService implements IFkNameEnricherService {
  constructor(
    private readonly db: Firestore,
    private readonly screenProvider: IScreenDefinitionProvider,
  ) {}

  /**
   * Campos `reference` da coleção — os fixos do código e os que a tela do tenant declara, pela MESMA
   * resolução que a tela e a automação usam. A tela é encontrada pela coleção que ela descreve, e não
   * pela própria chave: `contratos` descreve `contracts`.
   */
  private fkSchemaOf(ctx: SchemaContext, collection: string): Record<string, FkFieldSpec> {
    const schema: Record<string, FkFieldSpec> = { ...ENTITY_FK_SCHEMA[collection] };
    for (const field of resolveEntity(ctx, collection)?.fields ?? []) {
      if (!field.refEntity) continue;
      schema[field.key] = {
        targetCollection: field.refEntity,
        multi: field.multi === true || field.type === 'stringArray',
      };
    }
    return schema;
  }

  async enrichDiff(tenantId: string, collection: string, screenKey: string | undefined, diff: AuditFieldDiff): Promise<AuditFieldDiff> {
    void screenKey;
    const ctx = await this.screenProvider.getSchemaContext(tenantId);
    const schema = this.fkSchemaOf(ctx, collection);
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
      const config = getFlatEntityConfig(ref.collection, resolveEntity(ctx, ref.collection));
      const name = config?.getDisplayName(snap.data() as EntityData);
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
