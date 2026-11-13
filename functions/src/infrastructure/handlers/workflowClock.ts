import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getDI } from '../di/container';
import { isClockedDefinition, runWorkflowClockRound, syncWorkflowClockEntry } from '../../domain/services/workflowClock';
import type { ClockedDefinition } from '../../domain/services/workflowClock';
import { WORKFLOW_CLOCK_TICK_MINUTES } from '../../domain/schema/workflowClock';
import { versionArtifactOnWrite, versionWorkflowOnWrite } from '../../domain/services/workflowVersions';
import { SCRIPT_VERSION_CONTENT_KEYS } from '../../domain/schema/workflowVersion';
import { remindDueApprovals } from '../../domain/services/approvalReminders';

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

/** Quantas aprovações vencidas de lembrete uma volta lembra. O resto fica para a próxima. */
const APPROVAL_REMINDER_SWEEP_LIMIT = 100;

/** Quantos pedidos HTTP vencidos uma volta devolve à fila. O resto fica para a próxima. */
const HTTP_DISPATCH_SWEEP_LIMIT = 200;

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
 * Numera a automação a cada mudança de conteúdo e guarda a versão (`versionWorkflowOnWrite`). Um gatilho
 * próprio, e não dentro do `syncWorkflowClock`, porque aquele sai cedo para toda automação que não é de
 * horário — e toda automação tem versão.
 */
export const versionWorkflowDefinition = onDocumentWritten(
  { document: 'tenants/{tenantId}/workflow_definitions/{definitionId}', region: REGION },
  async (event) => {
    const { tenantId, definitionId } = event.params;
    try {
      await versionWorkflowOnWrite(
        tenantId,
        definitionId,
        event.data?.before.data(),
        event.data?.after.data(),
        getDI().getWorkflowVersionRepository(),
      );
    } catch (error) {
      console.error(`[workflow-version] Falha ao guardar a versão de ${tenantId}/${definitionId}:`, error);
    }
  },
);

/**
 * Numera o SCRIPT a cada mudança de código ou de contrato, pelo mesmo caminho da automação. A retomada de
 * uma execução NÃO é presa à versão do script — ele é resolvido na hora, e a mudança vira aviso (ver
 * `changedDependencies`) —; a versão é o histórico e a restauração.
 */
export const versionScript = onDocumentWritten(
  { document: 'tenants/{tenantId}/scripts/{scriptId}', region: REGION },
  async (event) => {
    const { tenantId, scriptId } = event.params;
    try {
      await versionArtifactOnWrite(
        tenantId,
        scriptId,
        event.data?.before.data(),
        event.data?.after.data(),
        SCRIPT_VERSION_CONTENT_KEYS,
        getDI().getScriptVersionRepository(),
      );
    } catch (error) {
      console.error(`[script-version] Falha ao guardar a versão de ${tenantId}/${scriptId}:`, error);
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
    // A fila do passo HTTP assíncrono pega carona neste relógio em vez de ter um agendador próprio: é
    // uma consulta e algumas gravações, e o escritório que não usa a fila paga só a consulta vazia.
    // Isolada no try — a fila com defeito não pode atrasar automação de horário nenhuma.
    try {
      const requeued = await getDI().getHttpDispatchRepository().requeueDue(new Date(), HTTP_DISPATCH_SWEEP_LIMIT);
      if (requeued > 0) console.log(`[workflow-clock] ${requeued} pedido(s) HTTP de volta à fila`);
    } catch (error) {
      console.error('[workflow-clock] Falha ao devolver pedidos HTTP à fila:', error);
    }

    // O lembrete das aprovações pega a mesma carona, também isolado: um aviso com defeito não pode atrasar
    // o relógio, e a aprovação que não lembrou continua valendo até o prazo.
    try {
      const di = getDI();
      const reminded = await remindDueApprovals(
        { tasks: di.getWorkflowTaskRepository(), dispatch: di.getDispatchNotificationUseCase(), now: () => new Date() },
        APPROVAL_REMINDER_SWEEP_LIMIT,
      );
      if (reminded > 0) console.log(`[workflow-clock] ${reminded} aprovação(ões) lembrada(s)`);
    } catch (error) {
      console.error('[workflow-clock] Falha ao lembrar aprovações:', error);
    }

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
