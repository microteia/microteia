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
 * Use Case que cria um novo push ou atualiza um existente.
 * Verifica se já existe um push com o mesmo emailId E processNumber.
 * - Se não existe: cria um novo
 * - Se existe com status 'fault': atualiza todos os campos
 * - Se existe com outro status: não faz nada (retorna o existente)
 */
export const makeCreateOrUpdatePushUseCase = (repo: IPushRepository): CreateOrUpdatePushUseCase => ({
  execute: async (tenantId, input) => {
    const processNumber = input.processNumber || '';

    const existing = await repo.getByEmailIdAndProcessNumber(tenantId, input.emailId, processNumber);

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
