import type { Firestore } from 'firebase-admin/firestore';
import type { Contribution } from '../../domain/schema/plugin/contribution';
import type { MessageBundle } from '../../domain/schema/i18n/messages';
import { messageBundlesOf } from '../../domain/schema/i18n/extensionPoints';

interface CacheEntry {
  /** Os nomes de Cloud Function que as extensões LIGADAS deste escritório reivindicam. */
  claimedFunctions: Set<string>;
  /** As extensões instaladas e DESLIGADAS — as que o interruptor manda parar. */
  deactivatedPluginIds: Set<string>;
  messageBundles: MessageBundle[];
  loadedAt: number;
}

const DEFAULT_TTL_MS = 5 * 60_000;

/**
 * O que as extensões instaladas declaram e o KERNEL precisa saber em execução.
 *
 * Duas perguntas, e as duas são respondidas pela mesma leitura de `installed_extensions` — que é o
 * motivo de elas morarem juntas, como em `ScreenDefinitionCache`.
 *
 * A primeira é a INVERSA da que `@microteia/office` responde, e a distinção é a razão de ser deste
 * arquivo. Uma function de extensão pergunta "a MINHA extensão está instalada?" e passa o próprio id
 * — é `isExtensionInstalled`. Uma function do KERNEL reivindicada por uma extensão não pode fazer
 * essa pergunta sem escrever o id do reivindicante dentro do núcleo, e um id de extensão escrito no
 * kernel é exatamente o defeito que este projeto existe para não ter.
 *
 * Então ela pergunta pelo NOME DELA MESMA: *alguma* extensão instalada e ativa reivindica esta
 * function? O kernel nomeia só o que é dele, a resposta continua sendo dado do escritório, e quem
 * bifurcar a extensão para um pacote próprio continua sendo atendido sem alterar o núcleo.
 */
export class InstalledExtensionCache {
  private readonly entries = new Map<string, CacheEntry>();

  constructor(
    private readonly db: Firestore,
    private readonly ttlMs = DEFAULT_TTL_MS,
  ) {}

  /**
   * O interruptor, e ele é imediato: desativar a extensão na aplicação faz a function deixar de
   * atender no fim do TTL, sem depender de ninguém rodar o Console para retirá-la do projeto.
   */
  async claimsFunction(tenantId: string, functionName: string): Promise<boolean> {
    return (await this.load(tenantId)).claimedFunctions.has(functionName);
  }

  /**
   * Os catálogos que as extensões contribuem, para o backend poder RESOLVER uma referência.
   *
   * O backend nunca formatou frase — devolve a referência e deixa a resolução para a tela, que tem o
   * catálogo de quem lê. Quem consome pelo gateway de agente não é uma tela, e é por isso que a
   * leitura passou a ser necessária deste lado.
   */
  async messageBundles(tenantId: string): Promise<MessageBundle[]> {
    return (await this.load(tenantId)).messageBundles;
  }

  /**
   * As extensões que o escritório desligou. É a pergunta do motor de automações: uma automação de
   * extensão materializada continua no escritório depois da desativação, e só a execução pode pará-la.
   */
  async deactivatedPluginIds(tenantId: string): Promise<ReadonlySet<string>> {
    return (await this.load(tenantId)).deactivatedPluginIds;
  }

  invalidate(tenantId: string): void {
    this.entries.delete(tenantId);
  }

  private async load(tenantId: string): Promise<CacheEntry> {
    const cached = this.entries.get(tenantId);
    if (cached && Date.now() - cached.loadedAt < this.ttlMs) return cached;

    const snapshot = await this.db.collection(`tenants/${tenantId}/installed_extensions`).get();

    const claimedFunctions = new Set<string>();
    const deactivatedPluginIds = new Set<string>();
    const contributions: Contribution[] = [];

    for (const doc of snapshot.docs) {
      const data = doc.data();
      // Extensão desativada conta como não instalada — a mesma frase que `isExtensionInstalled` diz,
      // e é ela que faz o interruptor ser um interruptor.
      if (data.active === false) {
        deactivatedPluginIds.add(doc.id);
        continue;
      }

      const claimed = data.package?.manifest?.backend?.functions;
      if (Array.isArray(claimed)) {
        for (const name of claimed) if (typeof name === 'string') claimedFunctions.add(name);
      }

      const contributes = data.package?.manifest?.contributes;
      if (Array.isArray(contributes)) contributions.push(...(contributes as Contribution[]));
    }

    const entry: CacheEntry = {
      claimedFunctions,
      deactivatedPluginIds,
      messageBundles: messageBundlesOf(contributions),
      loadedAt: Date.now(),
    };
    this.entries.set(tenantId, entry);
    return entry;
  }
}
