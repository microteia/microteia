import type { Firestore } from 'firebase-admin/firestore';
import type { FieldDefinition } from '../../domain/entities/entitySchemas';
import {
  ENTITY_FK_SCHEMA,
  CUSTOM_FIELD_ENABLED_ENTITIES,
  BUILTIN_REF_ENTITIES,
  resolveRefEntityCollection,
} from '../../domain/entities/entitySchemas';

/**
 * Serviço responsável por enriquecer Foreign Keys em payloads de eventos de workflow.
 *
 * Enriquece automaticamente:
 * - Campos fixos (baseado em ENTITY_FK_SCHEMA)
 * - Campos customizados do tipo 'reference' (baseado em ScreenDefinition)
 *
 * Exemplo:
 * - Input:  { contractId: "abc123" }
 * - Output: { contractId: "abc123", contract: { id: "abc123", number: "001/2024", title: "..." } }
 */
export class FkEnricher {
  constructor(
    private readonly db: Firestore,
    private readonly tenantId: string,
  ) {}

  /**
   * Enriquece um payload com dados de FKs.
   *
   * @param collection - Nome da coleção (ex: 'cases', 'deadlines')
   * @param payload - Dados brutos da entidade
   * @param screenDefinition - Definição da tela (para campos customizados), opcional
   * @returns Payload enriquecido com FKs resolvidas
   */
  async enrichPayload(
    collection: string,
    payload: Record<string, unknown>,
    screenDefinition?: { fields: FieldDefinition[] },
  ): Promise<Record<string, unknown>> {
    console.log(`[FkEnricher] enrichPayload chamado para collection="${collection}"`);
    console.log(`[FkEnricher] payload.customValues:`, payload.customValues);
    console.log(`[FkEnricher] screenDefinition fornecido:`, screenDefinition ? 'SIM' : 'NÃO');
    if (screenDefinition) {
      console.log(`[FkEnricher] screenDefinition.fields:`, JSON.stringify(screenDefinition.fields, null, 2));
    }

    const enriched = { ...payload };

    // 1. Enriquecer campos fixos (usando ENTITY_FK_SCHEMA)
    const entitySchema = ENTITY_FK_SCHEMA[collection];
    if (entitySchema) {
      for (const [fieldKey, fkSpec] of Object.entries(entitySchema)) {
        const value = payload[fieldKey];
        if (!value) continue;

        if (fkSpec.multi && Array.isArray(value)) {
          // FK múltipla (ex: activePoleIds)
          enriched[fieldKey] = value; // Mantém IDs originais
          // Não enriquece arrays por performance (pode ter muitos IDs)
        } else if (typeof value === 'string') {
          // FK única (ex: contractId)
          const denormalized = await this.resolveFk(
            fkSpec.targetCollection,
            value,
            fkSpec.denormalizedFields,
          );

          // Adiciona objeto denormalizado com nome derivado do campo FK
          // Ex: contractId → contract, responsibleLawyerId → responsibleLawyer
          const denormKey = this.deriveDenormKey(fieldKey);
          enriched[denormKey] = denormalized;
        }
      }
    }

    // 2. Enriquecer campos customizados (usando ScreenDefinition)
    if (CUSTOM_FIELD_ENABLED_ENTITIES.has(collection) && payload.customValues && screenDefinition) {
      console.log(`[FkEnricher] Iniciando enriquecimento de customValues...`);
      const customValues = payload.customValues as Record<string, unknown>;
      const enrichedCustomValues = await this.enrichCustomValues(
        customValues,
        screenDefinition.fields,
      );
      enriched.customValues = enrichedCustomValues;
      console.log(`[FkEnricher] customValues enriquecido:`, enriched.customValues);
    } else {
      console.log(`[FkEnricher] Pulando enriquecimento de customValues. Motivo:`);
      console.log(`  - É entidade com custom fields? ${CUSTOM_FIELD_ENABLED_ENTITIES.has(collection)}`);
      console.log(`  - payload.customValues existe? ${!!payload.customValues}`);
      console.log(`  - screenDefinition fornecido? ${!!screenDefinition}`);
    }

    return enriched;
  }

  /**
   * Enriquece campos customizados do tipo 'reference'.
   */
  private async enrichCustomValues(
    customValues: Record<string, unknown>,
    fields: FieldDefinition[],
  ): Promise<Record<string, unknown>> {
    const enriched = { ...customValues };

    console.log(`[FkEnricher] enrichCustomValues processando ${fields.length} campos`);

    for (const field of fields) {
      console.log(`[FkEnricher] Campo "${field.key}": type="${field.type}", refEntity="${field.refEntity}"`);

      if (field.type !== 'reference' || !field.refEntity) {
        console.log(`[FkEnricher]   → Pulando (não é reference ou não tem refEntity)`);
        continue;
      }

      const value = customValues[field.key];
      console.log(`[FkEnricher]   → Valor em customValues: ${JSON.stringify(value)}`);

      if (!value) {
        console.log(`[FkEnricher]   → Pulando (valor vazio/null/undefined)`);
        continue;
      }

      const targetCollection = resolveRefEntityCollection(field.refEntity);
      console.log(`[FkEnricher]   → Target collection: "${targetCollection}"`);

      if (field.multi && Array.isArray(value)) {
        // Referência múltipla
        console.log(`[FkEnricher]   → Enriquecendo array com ${value.length} itens...`);
        enriched[field.key] = await Promise.all(
          value.map((id) =>
            typeof id === 'string'
              ? this.resolveFkForCustomRecord(targetCollection, field.refEntity!, id)
              : id
          ),
        );
      } else if (typeof value === 'string') {
        // Referência única
        console.log(`[FkEnricher]   → Enriquecendo ID único: "${value}"`);
        const resolved = await this.resolveFkForCustomRecord(
          targetCollection,
          field.refEntity,
          value,
        );
        console.log(`[FkEnricher]   → Resultado do enriquecimento:`, resolved);
        enriched[field.key] = resolved;
      }
    }

    return enriched;
  }

  /**
   * Resolve uma FK para entidade builtin ou customRecord.
   * Para customRecords, inclui o título do registro.
   */
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

    // Para entidades builtin, usa denormalizedFields padrão
    if (BUILTIN_REF_ENTITIES.has(refEntity)) {
      const denormFields = this.getDefaultDenormFields(refEntity);
      return this.extractFields({ id, ...data }, denormFields);
    }

    // Para customRecords, inclui valores principais
    if (collection === 'customRecords') {
      const values = data.values as Record<string, unknown> | undefined;
      // Tenta pegar um campo "nome" ou "title" comum para o título
      const title = values?.nome || values?.title || values?.name || id;

      // Espalha os campos de values diretamente no objeto raiz
      // para facilitar acesso em expressões (ex: event.customValues.tarefa.nome)
      return {
        id,
        title: typeof title === 'string' ? title : String(title),
        screenKey: data.screenKey,
        ...(values || {}), // Espalha todos os campos customizados
      };
    }

    return { id, ...data };
  }

  /**
   * Resolve uma FK usando os campos especificados em denormalizedFields.
   */
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
      // Se não especificou campos, retorna tudo
      Object.assign(result, data);
    }

    return result;
  }

  /**
   * Extrai apenas os campos especificados de um objeto.
   */
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

  /**
   * Deriva o nome da chave denormalizada a partir do nome do campo FK.
   * Ex: contractId → contract, responsibleLawyerId → responsibleLawyer
   */
  private deriveDenormKey(fieldKey: string): string {
    // Remove 'Id' ou 'Ids' do final
    return fieldKey.replace(/Ids?$/, '');
  }

  /**
   * Retorna campos padrão para denormalização de entidades builtin.
   */
  private getDefaultDenormFields(refEntity: string): string[] {
    const defaults: Record<string, string[]> = {
      persons: ['name', 'type', 'email'],
      cases: ['caseNumber', 'title', 'area'],
      contracts: ['number', 'title', 'type'],
      deadlines: ['type', 'dueDate', 'priority'],
      financials: ['type', 'amount', 'dueDate'],
      members: ['name', 'email'],
    };
    return defaults[refEntity] || ['name', 'title'];
  }
}
