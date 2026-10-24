import type { Firestore } from 'firebase-admin/firestore';
import type { IScreenDefinitionProvider } from '../../domain/repositories/IScreenDefinitionProvider';
import type { SchemaContext, SchemaScreen } from '../../domain/schema/pathResolver';
import { createSchemaContext } from '../../domain/schema/pathResolver';
import type { SchemaLookup } from '../../domain/schema/screenEntity';
import { readEditWindow } from '../../domain/schema/editWindow';
import type { RecordKeySpec } from '../../domain/schema/recordKeys';
import type { FieldDefinition, FieldOrigin } from '../../domain/entities/entitySchemas';
import type { Contribution } from '../../domain/schema/plugin/contribution';
import type { FieldRulePreset } from '../../domain/schema/fieldRulePresets';
import {
  DATA_FIELD_RULE_PRESET_POINT,
  fieldRulePresetOf,
} from '../../domain/schema/dataExtensionPoints';

interface CacheEntry {
  screens: SchemaScreen[];
  lookups: SchemaLookup[];
  fieldRulePresets: FieldRulePreset[];
  loadedAt: number;
}

const DEFAULT_TTL_MS = 5 * 60_000;

/**
 * As chaves declaradas na tela, como estão gravadas. Só fica a entrada que tem a forma mínima que a
 * conta da chave lê — nome e lista de campos —: uma entrada estragada no documento não pode derrubar
 * a gravação de toda a coleção.
 */
const recordKeysOf = (value: unknown): RecordKeySpec[] | null => {
  if (!Array.isArray(value)) return null;
  const keys = value.filter((key): key is RecordKeySpec =>
    typeof key === 'object' && key !== null
    && typeof (key as RecordKeySpec).name === 'string'
    && Array.isArray((key as RecordKeySpec).fields)
    && (key as RecordKeySpec).fields.every((field) => typeof field === 'string'));
  return keys.length > 0 ? keys : null;
};

export class ScreenDefinitionCache implements IScreenDefinitionProvider {
  private readonly entries = new Map<string, CacheEntry>();

  constructor(
    private readonly db: Firestore,
    private readonly ttlMs = DEFAULT_TTL_MS,
  ) {}

  async getScreens(tenantId: string): Promise<SchemaScreen[]> {
    return (await this.load(tenantId)).screens;
  }

  async getLookups(tenantId: string): Promise<SchemaLookup[]> {
    return (await this.load(tenantId)).lookups;
  }

  /** As telas e as listas do tenant no mesmo contexto — a forma que a camada de schema consome. */
  async getSchemaContext(tenantId: string): Promise<SchemaContext> {
    const entry = await this.load(tenantId);
    return createSchemaContext(entry.screens, entry.lookups, [], entry.fieldRulePresets);
  }

  private async load(tenantId: string): Promise<CacheEntry> {
    const cached = this.entries.get(tenantId);
    if (cached && Date.now() - cached.loadedAt < this.ttlMs) {
      return cached;
    }

    const [snapshot, lookupSnapshot, extensionSnapshot] = await Promise.all([
      this.db.collection(`tenants/${tenantId}/screenDefinitions`).get(),
      this.db.collection(`tenants/${tenantId}/lookupDefinitions`).get(),
      this.db.collection(`tenants/${tenantId}/installed_extensions`).get(),
    ]);

    // O documento inteiro vale aqui: front e back resolvem os campos com a MESMA função
    // (`resolveEntity`), então um ajuste feito no Form Design vale igualmente para a gravação por
    // automação. Descartar qualquer parte faria a tela e o workflow divergirem.
    const screens: SchemaScreen[] = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        // A tela pode descrever uma coleção que não leva o nome dela; é por essa coleção que a
        // declaração vale, aqui como no front.
        collection: typeof data.dataCollection === 'string' ? data.dataCollection : undefined,
        titleSingular: typeof data.titleSingular === 'string' ? data.titleSingular : doc.id,
        titlePlural: typeof data.titlePlural === 'string' ? data.titlePlural : undefined,
        titleFieldKey: typeof data.titleFieldKey === 'string' ? data.titleFieldKey : '',
        fields: Array.isArray(data.fields) ? (data.fields as FieldDefinition[]) : [],
        tagCollection: typeof data.tagCollection === 'string' ? data.tagCollection : undefined,
        eventPrefix: typeof data.eventPrefix === 'string' ? data.eventPrefix : undefined,
        hasDocuments: data.hasDocuments === true,
        origin: typeof data.origin === 'string' ? (data.origin as FieldOrigin) : null,
        sourceId: typeof data.sourceId === 'string' ? data.sourceId : null,
        // Sem `keys`, a automação, o agente, o portal e a adoção viam só o açúcar `unique` de campo: a
        // chave declarada na TELA — a forma das chaves compostas — valia no formulário e em mais nada.
        keys: recordKeysOf(data.keys),
        editWindow: readEditWindow(data.editWindow),
        memberWritableFields: Array.isArray(data.memberWritableFields)
          ? (data.memberWritableFields as unknown[]).filter((field): field is string => typeof field === 'string')
          : null,
      };
    });

    const lookups: SchemaLookup[] = lookupSnapshot.docs.map((doc) => ({
      collection: doc.id,
      label: typeof doc.data().label === 'string' ? (doc.data().label as string) : doc.id,
    }));

    // A mesma declaração que o formulário usa para mascarar e validar precisa valer aqui, senão a
    // gravação por automação divergiria da gravação pela tela. Só extensão LIGADA contribui.
    const fieldRulePresets: FieldRulePreset[] = extensionSnapshot.docs.flatMap((doc) => {
      const data = doc.data();
      if (data.active === false) return [];
      const contributes = data.package?.manifest?.contributes;
      if (!Array.isArray(contributes)) return [];
      return (contributes as Contribution[])
        .filter((contribution) => contribution?.point === DATA_FIELD_RULE_PRESET_POINT)
        .map(fieldRulePresetOf)
        .filter((preset): preset is FieldRulePreset => preset !== undefined);
    });

    const entry: CacheEntry = { screens, lookups, fieldRulePresets, loadedAt: Date.now() };
    this.entries.set(tenantId, entry);
    return entry;
  }

  async getScreen(tenantId: string, screenKey: string): Promise<SchemaScreen | undefined> {
    const screens = await this.getScreens(tenantId);
    return screens.find((screen) => screen.id === screenKey);
  }

  invalidate(tenantId: string): void {
    this.entries.delete(tenantId);
  }
}
