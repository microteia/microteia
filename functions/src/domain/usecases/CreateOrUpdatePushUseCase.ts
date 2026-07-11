import type { Push } from '../entities/Push';
import type { IPushRepository } from '../repositories/IPushRepository';

export interface CreateOrUpdatePushInput {
  emailId: string;
  from: string;
  to: string;
  subject: string;
  receivedAt: Date;
  emailBodyHtml?: string;
  emailBodyText?: string;
  processNumber?: string;
  court?: string;
  activeParty?: string;
  passiveParty?: string;
  legalClass?: string;
  filingDate?: Date;
  distributionType?: string;
  processSubject?: string;
  movements?: Array<{
    date: Date;
    type: string;
    description?: string;
    documentUrl?: string;
  }>;
  status: 'pending' | 'reviewed' | 'archived' | 'fault';
  parsedByAI: boolean;
  parsingError?: string;
  createdBy: string;
}

export interface CreateOrUpdatePushResult {
  push: Push;
  wasUpdated: boolean; // true se atualizou existente, false se criou novo
}

export type CreateOrUpdatePushUseCase = {
  execute: (tenantId: string, input: CreateOrUpdatePushInput) => Promise<CreateOrUpdatePushResult>;
};

/**
 * Chave que distingue intimações dentro de um mesmo e-mail e processo.
 * Um e-mail pode trazer VÁRIAS intimações do MESMO processo (publicações
 * diferentes) — cada uma deve virar um push próprio. Usa a URL do documento
 * (única por intimação) e, na falta dela, uma composição de campos estáveis.
 */
const notificationKey = (input: Pick<CreateOrUpdatePushInput, 'court' | 'processSubject' | 'activeParty' | 'movements'>): string => {
  const movement = input.movements?.[0];
  if (movement?.documentUrl) return movement.documentUrl;
  return [
    input.court,
    input.processSubject,
    input.activeParty,
    movement?.date instanceof Date ? movement.date.toISOString() : undefined,
    movement?.type,
  ].filter(Boolean).join('|');
};

/**
 * Use Case que cria um novo push ou atualiza um existente.
 * Verifica se já existe um push com o mesmo emailId + processNumber + intimação
 * (ver notificationKey — um processo pode ter várias intimações no mesmo e-mail).
 * - Se não existe: cria um novo
 * - Se existe com status 'fault': atualiza todos os campos
 * - Se existe com outro status: não faz nada (retorna o existente)
 */
export const makeCreateOrUpdatePushUseCase = (repo: IPushRepository): CreateOrUpdatePushUseCase => ({
  execute: async (tenantId, input) => {
    const processNumber = input.processNumber || '';

    const candidates = await repo.getByEmailIdAndProcessNumber(tenantId, input.emailId, processNumber);
    const key = notificationKey(input);
    const existing = candidates.find((candidate) => notificationKey(candidate) === key) ?? null;

    if (!existing) {
      const newPush = await repo.create(tenantId, {
        emailId: input.emailId,
        from: input.from,
        to: input.to,
        subject: input.subject,
        receivedAt: input.receivedAt,
        emailBodyHtml: input.emailBodyHtml,
        emailBodyText: input.emailBodyText,
        processNumber: input.processNumber,
        court: input.court,
        activeParty: input.activeParty,
        passiveParty: input.passiveParty,
        legalClass: input.legalClass,
        filingDate: input.filingDate,
        distributionType: input.distributionType,
        processSubject: input.processSubject,
        movements: input.movements,
        status: input.status,
        parsedByAI: input.parsedByAI,
        parsingError: input.parsingError,
        createdBy: input.createdBy,
      });

      return {
        push: newPush,
        wasUpdated: false,
      };
    }

    if (existing.status === 'fault') {
      await repo.update(tenantId, existing.id, {
        subject: input.subject,
        processNumber: input.processNumber,
        court: input.court,
        activeParty: input.activeParty,
        passiveParty: input.passiveParty,
        legalClass: input.legalClass,
        filingDate: input.filingDate,
        distributionType: input.distributionType,
        processSubject: input.processSubject,
        movements: input.movements,
        status: input.status,
        parsedByAI: input.parsedByAI,
        parsingError: input.parsingError,
      });

      return {
        push: existing,
        wasUpdated: true,
      };
    }

    return {
      push: existing,
      wasUpdated: false,
    };
  },
});
