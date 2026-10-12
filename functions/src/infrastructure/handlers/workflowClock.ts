import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getDI } from '../di/container';
import { isClockedDefinition, runWorkflowClockRound, syncWorkflowClockEntry } from '../../domain/services/workflowClock';
import type { ClockedDefinition } from '../../domain/services/workflowClock';
import { WORKFLOW_CLOCK_TICK_MINUTES } from '../../domain/schema/workflowClock';

const REGION = 'southamerica-east1';

/**
 * Quantas voltas uma execução do relógio dá antes de devolver o turno. Uma volta cheia (o lote inteiro
 * vencido) é sinal de atraso acumulado, e a seguinte começa na hora; o teto impede que uma execução
 * ocupe o intervalo da próxima.
 */
const MAX_ROUNDS_PER_TICK = 5;

/**
 * Tempo depois do qual a execução não começa outra volta. Uma volta de gatilho de data trata páginas de
 * registros; o que sobrar continua vencido e é da execução seguinte, em vez de estourar o timeout no meio.
 */
const TICK_BUDGET_MS = 150_000;

/**
 * Mantém o relógio de cada automação de acordo com a definição dela. A definição é gravada pelo
 * navegador (o editor e a instalação de extensão), e o próximo disparo é calculado AQUI — um número que
 * decide quando o kernel age não pode vir de quem grava pelo cliente.
 *
 * Gravação de automação que não é nem foi de horário sai sem ler nada.
 */
export const syncWorkflowClock = onDocumentWritten(
  { document: 'tenants/{tenantId}/workflow_definitions/{definitionId}', region: REGION },
  async (event) => {
    const before = event.data?.before.data() as ClockedDefinition | undefined;
    const after = event.data?.after.data() as ClockedDefinition | undefined;
    if (!isClockedDefinition(before) && !isClockedDefinition(after)) return;

    const { tenantId, definitionId } = event.params;
    try {
      await syncWorkflowClockEntry(tenantId, definitionId, after ?? null, getDI().getWorkflowClockDeps());
    } catch (error) {
      console.error(`[workflow-clock] Falha ao acertar o relógio de ${tenantId}/${definitionId}:`, error);
    }
  },
);

/**
 * O RELÓGIO do kernel — um job do Cloud Scheduler para o projeto inteiro. Ele não conhece escritório
 * nem extensão: pergunta quais automações temporais venceram e publica o evento de cada uma, com alvo.
 * Onde a extensão não está instalada não há definição, e onde está desativada o motor recusa o evento.
 */
export const runWorkflowClock = onSchedule(
  { schedule: `every ${WORKFLOW_CLOCK_TICK_MINUTES} minutes`, region: REGION, timeoutSeconds: 240 },
  async () => {
    const deps = getDI().getWorkflowClockDeps();
    const startedAt = Date.now();
    for (let round = 0; round < MAX_ROUNDS_PER_TICK && Date.now() - startedAt < TICK_BUDGET_MS; round += 1) {
      const result = await runWorkflowClockRound(deps);
      if (result.fired + result.failed > 0) {
        console.log(`[workflow-clock] volta ${round + 1}: ${result.fired} tratada(s), ${result.stale} já tratada(s), ${result.failed} falha(s)`);
      }
      if (!result.saturated) return;
    }
  },
);
