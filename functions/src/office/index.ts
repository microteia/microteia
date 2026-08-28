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

/**
 * O documento tem o id do plugin — é assim que a aplicação o grava e o apaga —, então a pergunta é uma
 * leitura pontual, e não uma consulta. Desativar a extensão conta como não instalada: o pacote continua
 * no escritório e nada dele está no ar, que é exatamente a promessa do interruptor.
 */
const gate = createInstallationGate(async (tenantId: string, pluginId: string): Promise<boolean> => {
  const snapshot = await getDb().doc(`tenants/${tenantId}/installed_extensions/${pluginId}`).get();
  return snapshot.exists && snapshot.get('active') !== false;
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
