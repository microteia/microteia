import type { EntityRecord } from '../../../domain/entities';
import type { ActionSurface } from '../../../domain/schema/actionExpression';
import type { TranslateFn } from '../i18n/useT';

/**
 * O que o kernel entrega a uma ação de registro. É uma API estreita de propósito: o comando NÃO
 * enxerga stores, repositórios nem componentes — só o registro, onde ele vive e as operações que a
 * tela sabe executar. É o mesmo desenho da ponte das extensões, e o que permite que a mesma ação
 * rode no cartão da listagem, no cabeçalho do detalhe e dentro da aba de outro registro.
 */
export interface RecordActionHost {
  record: EntityRecord;
  /** Coleção onde o registro vive — não a chave da tela, que endereça só a UI. */
  collection: string;
  screenKey: string;
  surface: ActionSurface;
  /**
   * Vínculo com o registro-pai quando a ação acontece dentro da aba dele. `required` diz se o campo
   * que liga é obrigatório — e um vínculo obrigatório não se desfaz.
   */
  parent: { fieldKey: string; recordId: string; required: boolean } | null;
  /**
   * Como o registro é ENDEREÇADO nesta tela: a aba que o abre e a que abre uma cópia dele. Vêm do
   * host, e não do comando, porque cada tela sabe o próprio esquema de abas — a genérica usa
   * `view-dyn:`, uma tela de extensão usa o prefixo dela. O comando diz O QUÊ; o host diz ONDE.
   */
  recordTabKey: string;
  cloneTabKey: string;
  openTab: (tabKey: string) => void;
  notify: (message: string, tone: 'success' | 'error') => void;
  /** Grava um patch no próprio registro. */
  patchRecord: (patch: Record<string, unknown>) => Promise<void>;
  /** Copia um texto para a área de transferência. */
  copyText: (text: string) => Promise<void>;
  /** Abre o gerenciador de etiquetas do registro. */
  openTagManager: () => void;
  /** Abre a confirmação de exclusão do registro — a exclusão em si é da tela, não do comando. */
  requestDelete: () => void;
  /**
   * O tradutor do `core.records`. Vem no host pelo mesmo motivo que `notify`: o comando é função
   * pura, executada fora de componente, e não tem como pendurar um hook.
   */
  t: TranslateFn;
}

export type RecordActionCommand = (host: RecordActionHost) => void | Promise<void>;
