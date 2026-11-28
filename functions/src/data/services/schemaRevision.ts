import type { Firestore } from 'firebase-admin/firestore';

/**
 * O carimbo que diz aos caches de cada instância que a declaração mudou (#58).
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

/**
 * O teto da cópia em memória. Continua valendo porque nem tudo o que os caches leem move o carimbo:
 * as listas, as etiquetas, as extensões ligadas e as portas restritas ainda esperam por ele.
 */
export const SCHEMA_CACHE_TTL_MS = 5 * 60_000;

/**
 * De quanto em quanto tempo a instância confere o carimbo. É a janela em que uma tela recém gravada
 * ainda pode passar despercebida — somada à demora do gatilho —, ao preço de uma leitura de documento
 * por escritório nesse intervalo.
 */
export const SCHEMA_REVISION_CHECK_MS = 5_000;

interface Entry<T> {
  value: T;
  /** O carimbo lido ANTES do valor; `null` enquanto nenhuma tela foi gravada depois do #58. */
  revision: number | null;
  loadedAt: number;
  checkedAt: number;
}

/**
 * Uma cópia por escritório do que deriva das telas, conferida contra o carimbo. Uma classe só para os
 * dois caches que dependem da declaração: a ordem das leituras abaixo é o que impede a cópia velha de
 * ficar marcada como atual, e duas implementações dela divergiriam na primeira correção.
 */
export class RevisionedTenantCache<T> {
  private readonly entries = new Map<string, Entry<T>>();
  private readonly db: Firestore;
  private readonly load: (tenantId: string) => Promise<T>;
  private readonly ttlMs: number;
  private readonly checkMs: number;

  constructor(
    db: Firestore,
    load: (tenantId: string) => Promise<T>,
    ttlMs = SCHEMA_CACHE_TTL_MS,
    checkMs = SCHEMA_REVISION_CHECK_MS,
  ) {
    this.db = db;
    this.load = load;
    this.ttlMs = ttlMs;
    this.checkMs = checkMs;
  }

  async get(tenantId: string): Promise<T> {
    const cached = this.entries.get(tenantId);
    const alive = cached !== undefined && Date.now() - cached.loadedAt < this.ttlMs;
    if (alive && Date.now() - cached.checkedAt < this.checkMs) return cached.value;

    // O carimbo vem ANTES do valor, nunca junto: lido em paralelo, ele poderia já trazer o número novo
    // enquanto a consulta das telas devolvia a versão de antes — e a cópia velha ficaria marcada como
    // atual. Na ordem, o pior caso é o inverso: uma releitura a mais.
    const revision = await this.readRevision(tenantId);
    if (alive && revision === cached.revision) {
      this.entries.set(tenantId, { ...cached, checkedAt: Date.now() });
      return cached.value;
    }

    const value = await this.load(tenantId);
    const loadedAt = Date.now();
    this.entries.set(tenantId, { value, revision, loadedAt, checkedAt: loadedAt });
    return value;
  }

  invalidate(tenantId: string): void {
    this.entries.delete(tenantId);
  }

  private async readRevision(tenantId: string): Promise<number | null> {
    const snapshot = await this.db.doc(schemaRevisionPath(tenantId)).get();
    const value: unknown = snapshot.exists ? snapshot.get(SCHEMA_REVISION_FIELD) : null;
    return typeof value === 'number' ? value : null;
  }
}
