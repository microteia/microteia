import type { Firestore } from 'firebase-admin/firestore';
import type { IScreenDefinitionProvider } from '../../domain/repositories/IScreenDefinitionProvider';
import type { SchemaContext, SchemaScreen } from '../../domain/schema/pathResolver';
import { createSchemaContext } from '../../domain/schema/pathResolver';
import type { SchemaLookup } from '../../domain/schema/screenEntity';
import type { FieldDefinition } from '../../domain/entities/entitySchemas';

interface CacheEntry {
  screens: SchemaScreen[];
  lookups: SchemaLookup[];
  loadedAt: number;
}

const DEFAULT_TTL_MS = 5 * 60_000;

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
    return createSchemaContext(entry.screens, entry.lookups);
  }

  private async load(tenantId: string): Promise<CacheEntry> {
    const cached = this.entries.get(tenantId);
    if (cached && Date.now() - cached.loadedAt < this.ttlMs) {
      return cached;
    }

    const [snapshot, lookupSnapshot] = await Promise.all([
      this.db.collection(`tenants/${tenantId}/screenDefinitions`).get(),
      this.db.collection(`tenants/${tenantId}/lookupDefinitions`).get(),
    ]);

    // O documento inteiro vale aqui: front e back resolvem os campos com a MESMA função
    // (`resolveEntity`), então um ajuste feito no Form Design vale igualmente para a gravação por
    // automação. Descartar qualquer parte faria a tela e o workflow divergirem.
    const screens: SchemaScreen[] = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        titleSingular: typeof data.titleSingular === 'string' ? data.titleSingular : doc.id,
        titlePlural: typeof data.titlePlural === 'string' ? data.titlePlural : undefined,
        titleFieldKey: typeof data.titleFieldKey === 'string' ? data.titleFieldKey : '',
        fields: Array.isArray(data.fields) ? (data.fields as FieldDefinition[]) : [],
      };
    });

    const lookups: SchemaLookup[] = lookupSnapshot.docs.map((doc) => ({
      collection: doc.id,
      label: typeof doc.data().label === 'string' ? (doc.data().label as string) : doc.id,
    }));

    const entry: CacheEntry = { screens, lookups, loadedAt: Date.now() };
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
