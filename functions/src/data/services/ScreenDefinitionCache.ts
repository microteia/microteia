import type { Firestore } from 'firebase-admin/firestore';
import type { IScreenDefinitionProvider } from '../../domain/repositories/IScreenDefinitionProvider';
import type { SchemaScreen } from '../../domain/schema/pathResolver';
import type { FieldDefinition } from '../../domain/entities/entitySchemas';

interface CacheEntry {
  screens: SchemaScreen[];
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
    const cached = this.entries.get(tenantId);
    if (cached && Date.now() - cached.loadedAt < this.ttlMs) {
      return cached.screens;
    }

    const snapshot = await this.db.collection(`tenants/${tenantId}/screenDefinitions`).get();

    // `nativeFieldOverrides` é lido do documento apenas pelo FRONT, e o descarte aqui é PROPOSITAL:
    // o Form Design só ajusta apresentação e as expressões front-only dos campos fixos. Tipo,
    // máscara, `rules`, `logic.validate` e `logic.compute` continuam vindo do entityRegistry, que o
    // backend lê. Passar a respeitar o override aqui sem estender o escopo do Form Design faria a
    // gravação por workflow divergir da tela.
    const screens: SchemaScreen[] = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        titleSingular: typeof data.titleSingular === 'string' ? data.titleSingular : doc.id,
        titleFieldKey: typeof data.titleFieldKey === 'string' ? data.titleFieldKey : '',
        fields: Array.isArray(data.fields) ? (data.fields as FieldDefinition[]) : [],
      };
    });

    this.entries.set(tenantId, { screens, loadedAt: Date.now() });
    return screens;
  }

  async getScreen(tenantId: string, screenKey: string): Promise<SchemaScreen | undefined> {
    const screens = await this.getScreens(tenantId);
    return screens.find((screen) => screen.id === screenKey);
  }

  invalidate(tenantId: string): void {
    this.entries.delete(tenantId);
  }
}
