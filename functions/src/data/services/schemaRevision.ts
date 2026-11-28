/**
 * O carimbo que diz ao cache de telas de cada instância que a declaração mudou (#58).
 *
 * O cache vive na memória de uma instância, e a gravação da tela acontece em outra — no navegador, no
 * pacote, no MCP, no Console. Sem um sinal comum, a instância quente seguia até cinco minutos com a
 * tela de antes: o filho gravado nessa janela não recalculava o agregado do pai, e o agente recusava a
 * coleção que acabara de nascer. O número sobe a cada gravação de tela (por gatilho, a única porta por
 * onde todos os caminhos passam) e custa ao cache uma leitura de documento para conferir.
 *
 * Mora em `settings`, coleção reservada: nenhum gatilho de registro reage a ela, e a regra não deixa o
 * cliente gravar este documento.
 */
export const SCHEMA_REVISION_FIELD = 'revision';

export const schemaRevisionPath = (tenantId: string): string => `tenants/${tenantId}/settings/schema_revision`;
