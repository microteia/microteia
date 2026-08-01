import { generateDeepLink } from '../../infrastructure/deeplink/deepLinkUtils';
import type { RecordActionCommand } from '../../presentation/shared/recordActions/recordActionHost';
import type { UiRecordActionMetadata } from '../../presentation/shared/uiExtensionPoints';

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
  await host.copyText(generateDeepLink(host.recordTabKey));
  host.notify('Link copiado para a área de transferência.', 'success');
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
 * admin: quem pode editar o registro pode tirá-lo de um contrato.
 */
export const unlinkCommand: RecordActionCommand = async (host) => {
  if (!host.parent) return;
  try {
    await host.patchRecord({ [host.parent.fieldKey]: null });
    host.notify('Registro desvinculado.', 'success');
  } catch {
    host.notify('Não foi possível desvincular o registro.', 'error');
  }
};

export const RECORD_ACTION_METADATA: Record<string, UiRecordActionMetadata> = {
  copyLink: { key: 'copyLink', title: 'Copiar link', icon: 'link', order: 0 },
  clone: { key: 'clone', title: 'Duplicar', icon: 'fileCopy', order: 1 },
  manageTags: { key: 'manageTags', title: 'Gerenciar etiquetas', icon: 'priceTag3', order: 2, requiresTags: true },
  delete: {
    key: 'delete',
    title: 'Excluir',
    icon: 'deleteBin',
    order: 3,
    danger: true,
    requiresTenantAdmin: true,
    // Dentro da aba de um pai RELACIONADO o registro é uma entidade de topo: apagá-lo dali destruiria
    // o registro inteiro quando o gesto é "tirar daqui". Ali quem aparece é desvincular.
    hiddenWhen: 'relation == "related"',
  },
  unlink: {
    key: 'unlink',
    // Divide o slot destrutivo com excluir: a tela habilita `delete`, e a relação decide qual das
    // duas o usuário vê.
    slot: 'delete',
    title: 'Desvincular',
    icon: 'linkUnlink',
    order: 3,
    hiddenWhen: 'relation != "related"',
  },
};
