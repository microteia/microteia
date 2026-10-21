import { generateDeepLink } from '../../infrastructure/deeplink/deepLinkUtils';
import { recordLinkTabKey } from '../../domain/schema/recordLink';
import { unlinkFromParentPatch } from '../../domain/services/parentLock';
import type { RecordActionCommand } from '../../presentation/shared/recordActions/recordActionHost';
// A metadata dos gestos é declaração, e mora no domínio — ver `recordActionMetadata.ts`.
export { RECORD_ACTION_COMMANDS, RECORD_ACTION_METADATA } from '../../domain/schema/ui/recordActionMetadata';

/**
 * As ações que TODO registro oferece. Eram as únicas que o kernel sabia desenhar — escritas em
 * código, ligadas por caixa de seleção, sem rótulo, sem ordem e sem expressão. Aqui elas passam a
 * ser contribuições como quaisquer outras: a mesma metadata, o mesmo `hiddenWhen`, o mesmo caminho
 * de resolução. O kernel deixa de conhecê-las pelo nome.
 *
 * `slot` é o que permite duas ações disputarem o mesmo lugar: excluir e desvincular ocupam o slot
 * destrutivo (`delete`), e é o `hiddenWhen` de cada uma que decide qual aparece — o kernel não
 * escolhe, a declaração escolhe.
 */

export const copyLinkCommand: RecordActionCommand = async (host) => {
  // O link do REGISTRO, não da aba desta tela: é o mesmo formato do aviso e do e-mail, e abre pela
  // tela que descrever a coleção quando alguém clicar — inclusive outra, se a extensão mudar.
  await host.copyText(generateDeepLink(recordLinkTabKey({ collection: host.collection, recordId: host.record.id })));
  host.notify(host.t('action.copy-link.done'), 'success');
};

export const cloneCommand: RecordActionCommand = (host) => {
  host.openTab(host.cloneTabKey);
};

export const manageTagsCommand: RecordActionCommand = (host) => {
  host.openTagManager();
};

export const deleteCommand: RecordActionCommand = (host) => {
  host.requestDelete();
};

/**
 * Desvincular é uma gravação comum — limpa o campo que aponta para o pai —, e por isso não exige
 * admin: quem pode editar o registro pode tirá-lo de um contrato. Num `multi`, tira só o id do pai
 * da lista; preso por vários campos, desfaz em todos os que apontam (`unlinkFromParentPatch`).
 */
export const unlinkCommand: RecordActionCommand = async (host) => {
  if (!host.parent) return;
  // A lista já não oferece desvincular num vínculo obrigatório; a recusa aqui é para a lista de
  // ações montada à mão, que ainda pode nomear o comando.
  if (host.parent.required) {
    host.notify(host.t('action.unlink.required'), 'error');
    return;
  }
  try {
    const patch = unlinkFromParentPatch(host.record, host.parent.fieldKeys, host.parent.recordId);
    if (Object.keys(patch).length > 0) await host.patchRecord(patch);
    host.notify(host.t('action.unlink.done'), 'success');
  } catch {
    host.notify(host.t('action.unlink.failed'), 'error');
  }
};
