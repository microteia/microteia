import type { Firestore } from 'firebase-admin/firestore';
import type { FieldDefinition } from '../../domain/entities/entitySchemas';
import {
  CUSTOM_FIELD_ENABLED_ENTITIES,
  BUILTIN_REF_ENTITIES,
  resolveRefEntityCollection,
} from '../../domain/entities/entitySchemas';
import { getEntityByCollection } from '../../domain/schema/entityRegistry';

export class FkEnricher {
  constructor(
    private readonly db: Firestore,
    private readonly tenantId: string,
  ) {}

  async enrichPayload(
    collection: string,
    payload: Record<string, unknown>,
    screenDefinition?: { fields: FieldDefinition[] },
  ): Promise<Record<string, unknown>> {
    const enriched = { ...payload };

    const entity = getEntityByCollection(collection);
    if (entity) {
      for (const fk of entity.fks) {
        const value = payload[fk.key];
        if (!value) continue;

        if (fk.multi && Array.isArray(value)) {
          enriched[fk.key] = value;
        } else if (typeof value === 'string') {
          const denormalized = await this.resolveFk(fk.targetCollection, value, fk.denormalizedFields);
          enriched[fk.denormKey] = denormalized;
        }
      }
    }

    if (CUSTOM_FIELD_ENABLED_ENTITIES.has(collection) && payload.customValues && screenDefinition) {
      const customValues = payload.customValues as Record<string, unknown>;
      enriched.customValues = await this.enrichCustomValues(customValues, screenDefinition.fields);
    }

    return enriched;
  }

  private async enrichCustomValues(
    customValues: Record<string, unknown>,
    fields: FieldDefinition[],
  ): Promise<Record<string, unknown>> {
    const enriched = { ...customValues };

    for (const field of fields) {
      if (field.type !== 'reference' || !field.refEntity) continue;

      const value = customValues[field.key];
      if (!value) continue;

      const targetCollection = resolveRefEntityCollection(field.refEntity);

      if (field.multi && Array.isArray(value)) {
        enriched[field.key] = await Promise.all(
          value.map((id) =>
            typeof id === 'string'
              ? this.resolveFkForCustomRecord(targetCollection, field.refEntity!, id)
              : id,
          ),
        );
      } else if (typeof value === 'string') {
        enriched[field.key] = await this.resolveFkForCustomRecord(targetCollection, field.refEntity, value);
      }
    }

    return enriched;
  }

  private async resolveFkForCustomRecord(
    collection: string,
    refEntity: string,
    id: string,
  ): Promise<Record<string, unknown>> {
    const doc = await this.db
      .collection('tenants')
      .doc(this.tenantId)
      .collection(collection)
      .doc(id)
      .get();

    if (!doc.exists) {
      return { id };
    }

    const data = doc.data()!;

    if (BUILTIN_REF_ENTITIES.has(refEntity)) {
      const denormFields = getEntityByCollection(refEntity)?.referenceDenormFields ?? ['name', 'title'];
      return this.extractFields({ id, ...data }, denormFields);
    }

    if (collection === 'customRecords') {
      const values = data.values as Record<string, unknown> | undefined;
      const title = values?.nome || values?.title || values?.name || id;

      return {
        id,
        title: typeof title === 'string' ? title : String(title),
        screenKey: data.screenKey,
        ...(values || {}),
      };
    }

    return { id, ...data };
  }

  private async resolveFk(
    targetCollection: string,
    id: string,
    denormalizedFields?: string[],
  ): Promise<Record<string, unknown>> {
    const doc = await this.db
      .collection('tenants')
      .doc(this.tenantId)
      .collection(targetCollection)
      .doc(id)
      .get();

    if (!doc.exists) {
      return { id };
    }

    const data = doc.data()!;
    const result: Record<string, unknown> = { id };

    if (denormalizedFields) {
      for (const field of denormalizedFields) {
        if (field in data) {
          result[field] = data[field];
        }
      }
    } else {
      Object.assign(result, data);
    }

    return result;
  }

  private extractFields(
    data: Record<string, unknown>,
    fields: string[],
  ): Record<string, unknown> {
    const result: Record<string, unknown> = { id: data.id };
    for (const field of fields) {
      if (field !== 'id' && field in data) {
        result[field] = data[field];
      }
    }
    return result;
  }
}
