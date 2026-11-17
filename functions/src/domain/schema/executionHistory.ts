// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/executionHistory.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

/**
 * O histórico de uma execução mora em DOIS documentos, porque a regra do Firestore não projeta campo:
 * quem lê um documento lê tudo o que está nele.
 *
 * - O RESUMO (`workflow_executions/{id}`) — status, horários, quem disparou. Todo membro lê: é o que o
 *   Processador e o botão "executar" acompanham, e não carrega dado nenhum do que a automação tocou.
 * - O DETALHE (`workflow_executions/{id}/detail/run`) — as linhas de cada passo, com o que entrou e o que
 *   saiu, e a saída final. Só quem tem `automation.manage` lê. Ali está o registro que disparou a
 *   automação, o texto do documento lido, o corpo do e-mail — e isso ignorava a visibilidade por
 *   registro, a permissão de leitura da coleção e o sigilo da caixa pessoal. Quem tem `automation.manage`
 *   já lê o escritório inteiro (escreve uma automação que lê tudo), e por isso dar o detalhe a ele não
 *   abre nada novo.
 *
 * `schema` distingue o resumo do histórico antigo, que tinha tudo num documento só: a regra libera ao
 * membro só o que tem `schema == EXECUTION_HISTORY_SCHEMA`, e o antigo fica com quem gerencia — sem
 * migração, e sem que uma consulta do membro esbarre num documento que ele não pode ler.
 */
export const EXECUTION_HISTORY_SCHEMA = 2;

export const EXECUTION_DETAIL_COLLECTION = 'detail';

export const EXECUTION_DETAIL_DOC = 'run';

/**
 * Quantos dias o histórico de uma execução fica depois do último movimento dela — começo, fim ou hora
 * de continuar. Contar do começo apagaria a execução que ainda espera (uma aprovação, um `delay` de até
 * um ano), e a retomada seguiria sem as linhas de antes.
 *
 * O histórico é evidência de curto prazo — "por que essa automação falhou ontem?" —, não o arquivo do
 * escritório: ali fica o texto do documento lido, o corpo do e-mail, o registro que disparou. O que
 * precisa ficar por anos é gravado pela automação num registro, que tem dono, permissão e auditoria.
 */
export const EXECUTION_HISTORY_RETENTION_DAYS = 90;
