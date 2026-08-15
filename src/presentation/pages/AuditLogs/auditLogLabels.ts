import type { AuditAction, AuditSeverity, ScreenDefinition } from '../../../domain/entities';
import type { TranslateFn } from '../../shared/i18n/useT';

/**
 * Entidades que o kernel audita por nome próprio, e as que já saíram dele — os logs gravados antes
 * da migração guardam `Person`/`Case`/`Contract` e continuam legíveis. Log novo de tela declarada
 * guarda a COLEÇÃO, resolvida em `entityLabel`.
 */
export const ENTITY_KEYS: Record<string, string> = {
  Person: 'audit.entity.person',
  Case: 'audit.entity.case',
  Contract: 'audit.entity.contract',
  Deadline: 'audit.entity.deadline',
  Financial: 'audit.entity.financial',
  TenantMember: 'audit.entity.tenant-member',
  PersonTag: 'audit.entity.person-tag',
  CaseTag: 'audit.entity.case-tag',
  ContractTag: 'audit.entity.contract-tag',
  FinancialTag: 'audit.entity.financial-tag',
  PersonNote: 'audit.entity.person-note',
  CaseNote: 'audit.entity.case-note',
  ContractNote: 'audit.entity.contract-note',
  PersonDocument: 'audit.entity.person-document',
  CaseDocument: 'audit.entity.case-document',
  ContractDocument: 'audit.entity.contract-document',
  FinancialDocument: 'audit.entity.financial-document',
  Record: 'audit.entity.record',
  RecordNote: 'audit.entity.record-note',
  CustomRecordDocument: 'audit.entity.custom-record-document',
  ScreenDefinition: 'audit.entity.screen-definition',
  Tenant: 'audit.entity.tenant',
  Workflow: 'audit.entity.workflow',
  SYSTEM: 'audit.entity.system',
};

/**
 * A COLEÇÃO que cada nome ANTIGO do kernel designava.
 *
 * Pessoa, Processo e Contrato saíram do kernel e hoje são telas de extensão. A chave continua no
 * mapa acima para o log gravado naquela época permanecer legível — mas, sem esta tabela, a mesma
 * coisa aparecia DUAS vezes no filtro: uma com o nome que o kernel usava e outra com o nome que a
 * extensão deu. Aqui os dois se encontram: existindo a tela, ela é a dona do nome, e o log antigo
 * passa a ser exibido com o título de hoje em vez de congelado no de ontem.
 */
const LEGACY_COLLECTION: Record<string, string> = {
  Person: 'persons',
  PersonNote: 'persons#notes',
  PersonDocument: 'persons#documents',
  Case: 'cases',
  CaseNote: 'cases#notes',
  CaseDocument: 'cases#documents',
  Contract: 'contracts',
  ContractNote: 'contracts#notes',
  ContractDocument: 'contracts#documents',
  Deadline: 'deadlines',
  Financial: 'financials',
  FinancialDocument: 'financials#documents',
};

export const ACTION_KEYS: Record<AuditAction, string> = {
  CREATE: 'audit.action.create',
  UPDATE: 'audit.action.update',
  DELETE: 'audit.action.delete',
  SYSTEM: 'audit.action.system',
};

export const SEVERITY_KEYS: Record<AuditSeverity, string> = {
  LOW: 'audit.severity.low',
  HIGH: 'audit.severity.high',
  CRITICAL: 'audit.severity.critical',
};

const NESTED_PART_KEYS: Record<string, string> = {
  notes: 'audit.entity.note-of',
  documents: 'audit.entity.document-of',
};

const screenTitle = (screens: ScreenDefinition[], collection: string): ScreenDefinition | undefined =>
  screens.find((screen) => (screen.dataCollection ?? screen.id) === collection);

/**
 * O rótulo da entidade auditada. A chave fixa tem nome no código; a de tela declarada é a coleção
 * (`contracts`, `contracts#notes`) e recebe o nome da tela que a descreve HOJE — assim o log
 * acompanha o título quando a tela é renomeada, em vez de congelar o nome do dia da gravação.
 */
export const entityLabel = (
  t: TranslateFn,
  resolve: (value: string) => string,
  entity: string,
  screens: ScreenDefinition[] = [],
): string => {
  // Nome antigo do kernel: se a tela que herdou a coleção está instalada, ela dá o nome.
  const [collection, part] = (LEGACY_COLLECTION[entity] ?? entity).split('#');
  const screen = screenTitle(screens, collection);
  if (!screen) {
    const key = ENTITY_KEYS[entity];
    return key ? t(key) : entity;
  }
  const nestedKey = part ? NESTED_PART_KEYS[part] : undefined;
  return nestedKey ? t(nestedKey, { name: screen.titleSingular }) : resolve(screen.titleSingular);
};

export interface EntityFilterOption {
  value: string;
  label: string;
}

/**
 * As opções do filtro por entidade: as fixas do kernel mais o que o escritório declara.
 *
 * O nome antigo de uma coleção que HOJE tem tela fica de fora — a tela já a oferece, com o nome
 * que o escritório vê. Oferecer os dois seria pedir para filtrar "Pessoa" ou "Person" e obter
 * resultados diferentes para a mesma coisa.
 */
export const entityFilterOptions = (
  t: TranslateFn,
  resolve: (value: string) => string,
  screens: ScreenDefinition[] = [],
): EntityFilterOption[] => {
  const described = new Set(screens.map((screen) => screen.dataCollection ?? screen.id));
  const isSupersededByScreen = (entity: string): boolean => {
    const legacy = LEGACY_COLLECTION[entity];
    return legacy !== undefined && described.has(legacy.split('#')[0]);
  };

  const options = Object.entries(ENTITY_KEYS)
    .filter(([value]) => !isSupersededByScreen(value))
    .map(([value, key]) => ({ value, label: t(key) }));
  for (const screen of screens) {
    const collection = screen.dataCollection ?? screen.id;
    options.push({ value: collection, label: resolve(screen.titleSingular) });
    if (screen.hasNotes) {
      options.push({
        value: `${collection}#notes`,
        label: t('audit.entity.note-of', { name: screen.titleSingular }),
      });
    }
    if (screen.hasDocuments) {
      options.push({
        value: `${collection}#documents`,
        label: t('audit.entity.document-of', { name: screen.titleSingular }),
      });
    }
  }
  return options;
};
