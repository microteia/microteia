import type { WorkflowContext, WorkflowLogger } from '../../domain/entities/WorkflowContext';
import type { SeedWriteOutcome } from '../../domain/services/screenSeeds';
import { runWorkflowUpsert } from '../workflow/mutation/runWorkflowMutation';
import type { WorkflowMutationDeps } from '../workflow/mutation/runWorkflowMutation';
import { tenantTimeZone } from '../settings/tenantTimeZone';
import { tenantBusinessCalendars } from '../settings/tenantBusinessCalendars';

const silent: WorkflowLogger = { info: () => undefined, warn: () => undefined, error: () => undefined };

/**
 * A semente grava pelo MESMO caminho da importação, do agente e do portal: regras de campo, chaves,
 * sequência e valor de partida valem sem uma linha daqui. Sem ator — ninguém apertou nada — e sem
 * leitor: a semente não lê registro de ninguém. `enforceRequired` porque um catálogo pela metade é o
 * erro que o formulário existe para impedir, e `seedDefaults` porque o campo que a semente não traz
 * nasce como nasceria no formulário.
 */
export const makeScreenSeedWriter = (deps: WorkflowMutationDeps) =>
  async (tenantId: string, collection: string, data: Record<string, unknown>): Promise<SeedWriteOutcome> => {
    const context: WorkflowContext = {
      event: { id: '', tenantId, name: 'extension.seed', payload: {}, timestamp: new Date() },
      outputs: {},
      variables: {},
      services: {
        logger: silent,
        now: () => new Date(),
        timeZone: await tenantTimeZone(tenantId),
        businessCalendarsOf: tenantBusinessCalendars,
      },
      logger: silent,
      execution: { id: crypto.randomUUID(), workflowDefinitionId: '', tenantId },
      input: {},
    };
    const outcome = await runWorkflowUpsert({ table: collection, data }, context, deps, {
      seed: true,
      seedDefaults: true,
      enforceRequired: true,
    });
    return outcome.ok
      ? { ok: true }
      : { ok: false, error: outcome.error, ...(outcome.errorParams ? { errorParams: outcome.errorParams } : {}) };
  };
