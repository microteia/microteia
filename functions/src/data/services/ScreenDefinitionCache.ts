import type { Firestore } from 'firebase-admin/firestore';
import type { IScreenDefinitionProvider } from '../../domain/repositories/IScreenDefinitionProvider';
import type { SchemaContext, SchemaScreen } from '../../domain/schema/pathResolver';
import { createSchemaContext } from '../../domain/schema/pathResolver';
import type { SchemaLookup } from '../../domain/schema/screenEntity';
import { readEditWindow } from '../../domain/schema/editWindow';
import { readMemberVisibility } from '../../domain/schema/memberVisibility';
import { readListOrder } from '../../domain/schema/ui/listOrder';
import { asPortalDeclaration } from '../../domain/schema/portal';
import type { RecordKeySpec } from '../../domain/schema/recordKeys';
import type { FieldDefinition, FieldOrigin } from '../../domain/entities/entitySchemas';
import type { Contribution } from '../../domain/schema/plugin/contribution';
import type { FieldRulePreset } from '../../domain/schema/fieldRulePresets';
import {
  DATA_FIELD_RULE_PRESET_POINT,
  fieldRulePresetOf,
} from '../../domain/schema/dataExtensionPoints';
import { SCHEMA_REVISION_FIELD, schemaRevisionPath } from './schemaRevision';

interface CacheEntry {
  screens: SchemaScreen[];
  lookups: SchemaLookup[];
  fieldRulePresets: FieldRulePreset[];
  /** O carimbo lido ANTES das telas; `null` enquanto nenhuma tela foi gravada depois do #58. */
  revision: number | null;
  loadedAt: number;
  checkedAt: number;
}

/**
 * O teto da cópia em memória. Continua valendo porque nem tudo o que o cache lê move o carimbo: as
 * listas e os presets das extensões ligadas ainda esperam por ele.
 */
export const SCREEN_CACHE_TTL_MS = 5 * 60_000;

/**
 * De quanto em quanto tempo a instância confere o carimbo (#58). É a janela em que uma tela recém
 * gravada ainda pode passar despercebida — somada à demora do gatilho —, ao preço de uma leitura de
 * documento por escritório nesse intervalo.
 */
export const SCREEN_CACHE_REVALIDATE_MS = 5_000;

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
    private readonly ttlMs = SCREEN_CACHE_TTL_MS,
    private readonly revalidateMs = SCREEN_CACHE_REVALIDATE_MS,
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
    const fresh = cached !== undefined && Date.now() - cached.loadedAt < this.ttlMs;
    if (fresh && Date.now() - cached.checkedAt < this.revalidateMs) return cached;

    // O carimbo vem ANTES das telas, nunca junto: lido em paralelo, ele poderia já trazer o número
    // novo enquanto a consulta das telas devolvia a versão de antes — e a cópia velha ficaria marcada
    // como atual. Na ordem, o pior caso é o inverso: uma releitura a mais.
    const revision = await this.readRevision(tenantId);
    if (fresh && revision === cached.revision) {
      const confirmed: CacheEntry = { ...cached, checkedAt: Date.now() };
      this.entries.set(tenantId, confirmed);
      return confirmed;
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
        hasNotes: data.hasNotes === true,
        tracksPortalViews: asPortalDeclaration(data.portal)?.trackViews === true,
        allowImport: data.allowImport === true,
        origin: typeof data.origin === 'string' ? (data.origin as FieldOrigin) : null,
        sourceId: typeof data.sourceId === 'string' ? data.sourceId : null,
        // Sem `keys`, a automação, o agente, o portal e a adoção viam só o açúcar `unique` de campo: a
        // chave declarada na TELA — a forma das chaves compostas — valia no formulário e em mais nada.
        keys: recordKeysOf(data.keys),
        // A sequência por pai conta dentro do registro que este campo aponta — a automação precisa
        // do mesmo campo que o formulário usa, senão os dois contariam em contadores diferentes.
        parentFieldKey: typeof data.parentFieldKey === 'string' && data.parentFieldKey ? data.parentFieldKey : null,
        editWindow: readEditWindow(data.editWindow),
        // Sem ela, o relatório, o agente e o documento entregariam a uma pessoa o registro que a regra
        // esconde dela.
        memberVisibility: readMemberVisibility(data.memberVisibility),
        memberWritableFields: Array.isArray(data.memberWritableFields)
          ? (data.memberWritableFields as unknown[]).filter((field): field is string => typeof field === 'string')
          : null,
        listOrder: readListOrder(data.listOrder, Array.isArray(data.fields) ? (data.fields as FieldDefinition[]) : []),
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

    const loadedAt = Date.now();
    const entry: CacheEntry = { screens, lookups, fieldRulePresets, revision, loadedAt, checkedAt: loadedAt };
    this.entries.set(tenantId, entry);
    return entry;
  }

  private async readRevision(tenantId: string): Promise<number | null> {
    const snapshot = await this.db.doc(schemaRevisionPath(tenantId)).get();
    const value: unknown = snapshot.exists ? snapshot.get(SCHEMA_REVISION_FIELD) : null;
    return typeof value === 'number' ? value : null;
  }

  async getScreen(tenantId: string, screenKey: string): Promise<SchemaScreen | undefined> {
    const screens = await this.getScreens(tenantId);
    return screens.find((screen) => screen.id === screenKey);
  }

  invalidate(tenantId: string): void {
    this.entries.delete(tenantId);
  }
}
