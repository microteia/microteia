/**
 * `@microteia/office` — o que uma Cloud Function ESCRITA PELO ESCRITÓRIO importa da plataforma.
 *
 * É uma superfície curada, como `@microteia/ui` é do lado da tela, e pelo mesmo motivo: o que está aqui
 * é contrato, e o resto de `functions/src` não é. Ela chega ao autor como uma dependência local do
 * pacote instalado (`file:./office`), montada pelo `microteia pack`.
 *
 * Hoje ela tem uma coisa só, e é a que nenhuma extensão consegue resolver sozinha sem repetir o mesmo
 * código: agir apenas no escritório que a instalou.
 */
import { getDb } from '../infrastructure/firebase/initFirebase';
import { createInstallationGate } from './installationGate';

/**
 * The least a Firebase event has to carry for the gate to work: the path parameters, one of which must
 * be `{tenantId}`. Every Firestore trigger event satisfies it.
 */
export interface TenantScopedEvent {
  params: Record<string, string>;
}

const gate = createInstallationGate({
  /**
   * O documento tem o id do plugin — é assim que a aplicação o grava e o apaga —, então a pergunta é
   * uma leitura pontual, e não uma consulta. Desativar a extensão conta como não instalada: o pacote
   * continua no escritório e nada dele está no ar, que é exatamente a promessa do interruptor.
   */
  installed: async (tenantId: string, pluginId: string): Promise<boolean> => {
    const snapshot = await getDb().doc(`tenants/${tenantId}/installed_extensions/${pluginId}`).get();
    return snapshot.exists && snapshot.get('active') !== false;
  },

  /**
   * `listDocuments` e não `get`: ele devolve as referências sem ler os documentos, que é tudo o que se
   * precisa aqui — só os ids. E ele enxerga o escritório que só tem subcoleções, o que uma consulta de
   * coleção não garante.
   */
  offices: async (): Promise<string[]> => {
    const refs = await getDb().collection('tenants').listDocuments();
    return refs.map((ref) => ref.id);
  },
});

/**
 * True when the extension is installed and active in this organization.
 *
 * For when you need the answer in the middle of a flow — inside a callable, say, where the
 * organization comes from the request rather than from a trigger path.
 */
export const isExtensionInstalled: (tenantId: string, pluginId: string) => Promise<boolean> =
  gate.isExtensionInstalled;

/**
 * Wraps a trigger handler so it only runs in the organizations that installed your extension.
 *
 *     export const acmeOnSave = onDocumentWritten(
 *       { document: 'tenants/{tenantId}/invoices/{id}', region: 'southamerica-east1' },
 *       forInstalledExtension('com.acme.crm', async (event) => { ... }),
 *     );
 *
 * Without it the trigger runs for EVERY organization in the project — the ones that never installed
 * your extension, and the one that uninstalled it while another still has it. Uninstalling cannot
 * remove the function in that last case: it is still needed by somebody else. This is what makes the
 * withdrawal complete, and it is also what covers the minutes between the uninstall and the next
 * "microteia provision --prune".
 *
 * Fails closed: an event whose path carries no {tenantId} is skipped and logged.
 */
export const forInstalledExtension: <E extends TenantScopedEvent>(
  pluginId: string,
  handler: (event: E) => Promise<void> | void,
) => (event: E) => Promise<void> = gate.forInstalledExtension;

/**
 * Runs your handler once per organization that installed your extension, and returns how many.
 *
 *     export const acmeNightly = onSchedule(
 *       { schedule: 'every day 03:00', region: 'southamerica-east1' },
 *       async () => {
 *         await forEachInstalledOffice('com.acme.crm', async (tenantId) => { ... });
 *       },
 *     );
 *
 * This is for the triggers `forInstalledExtension` cannot help with. A scheduled run, a Pub/Sub
 * message, an HTTP request and a Storage event carry no {tenantId} in their path, so there is no
 * organization for the guard to ask about — it fails closed, which would leave your function inert even
 * while your extension IS installed. Without a guard it acts on the whole project instead: every
 * organization, including the ones that never installed your extension.
 *
 * It reads one document per organization, once per run, and asks the same question the trigger guard
 * asks — a deactivated extension counts as not installed.
 *
 * One organization failing does not take the others' turn: every installed organization runs, and the
 * function then fails naming the ones that did not. So a bad record in one place cannot silently
 * suspend the routine everywhere else, and a failure cannot pass unnoticed either.
 */
export const forEachInstalledOffice: (
  pluginId: string,
  handler: (tenantId: string) => Promise<void> | void,
) => Promise<number> = gate.forEachInstalledOffice;

/**
 * Wraps a trigger handler of a SHARED function so it runs where any of the extensions it serves is
 * installed.
 *
 *     export const acmeRecalcTotals = onDocumentWritten(
 *       { document: 'tenants/{tenantId}/invoices/{id}', region },
 *       forAnyInstalledExtension(['com.acme.crm', 'com.acme.billing'], async (event) => { ... }),
 *     );
 *
 * This is for a function in the installation's own `functions/` directory — the place for one that
 * SEVERAL extensions need. `forInstalledExtension` cannot answer there, because the question is not "is
 * this extension installed?" but "is any of the ones this function serves installed?".
 *
 * Any one of them is enough, and that is the only sensible rule: the function exists because more than
 * one extension needs it, so it is due while any of them is there. Requiring all of them would make
 * uninstalling one extension switch off the others' behaviour.
 *
 * Declare the same list in `microteia.serves` in `functions/package.json`. That is what tells the Console
 * the function may be withdrawn once none of them is installed anywhere in the project.
 *
 * Fails closed: an event whose path carries no {tenantId} is skipped and logged.
 */
export const forAnyInstalledExtension: <E extends TenantScopedEvent>(
  pluginIds: string[],
  handler: (event: E) => Promise<void> | void,
) => (event: E) => Promise<void> = gate.forAnyInstalledExtension;
