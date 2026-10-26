import type React from 'react';
import type { EntityRecord, ScreenDefinition, UserRole } from '../../../../../domain/entities';
import type { WorkflowDefinition } from '../../../../../domain/entities/Workflow';
import type { ThemeOption } from '../../../../../stores/useTheme';
import type { UiPageMetadata } from '../../../../../domain/schema/ui/uiExtensionPoints';
import type { TranslateFn } from '../../../../shared/i18n/useT';

export interface CommandPaletteItem {
  id: string;
  /** REFERÊNCIA de mensagem, ou o texto do escritório; `titleParams` interpola. */
  title: string;
  titleParams?: Record<string, string>;
  subtitle?: string;
  group: string;
  icon?: React.ReactNode;
  onSelect: () => void;
  keywords?: string[];
}

/**
 * Um relatório como a paleta o vê.
 *
 * `permissions` vem PRONTO, e é o ponto: derivá-lo aqui exigiria o esquema do escritório dentro de
 * um provedor, que é função pura chamada a cada tecla. Quem tem o esquema resolve antes.
 */
export interface CommandPaletteReport {
  key: string;
  /** REFERÊNCIA de mensagem ou o texto do escritório — quem exibe resolve. */
  title: string;
  /** O cadastro que o relatório cobre, mostrado como subtítulo. */
  covers: string;
  /**
   * Tudo o que vê-lo exige (`reportRequiredPermissions`): a permissão própria, quando declarada, e a
   * leitura de cada coleção que ele toca, inclusive as alcançadas por referência.
   */
  permissions: string[];
  enabled?: boolean;
}

export interface CommandPaletteAppContext {
  openTab: (key: string) => void;
  close: () => void;
  records: EntityRecord[];
  screenDefinitions: ScreenDefinition[];
  workflows: WorkflowDefinition[];
  reports: CommandPaletteReport[];
  /** O tema EM VIGOR e a lista de instalados — a paleta não conhece nome de tema nenhum. */
  themeId: string;
  themes: ThemeOption[];
  setTheme: (id: string) => void;
  signOut: () => Promise<void>;
  userRole: UserRole | null;
  /** A pergunta de autorização, não o papel: um provedor decide o que oferecer por capacidade. */
  can: (permission: string) => boolean;
  /** Telas abríveis, já filtradas por papel — vêm das contribuições `ui.page` dos plugins. */
  navigablePages: UiPageMetadata[];
  /**
   * O tradutor do `core.ui`. Ele entra no CONTEXTO porque um provider não é componente — `getItems`
   * é função pura, chamada a cada tecla, e não tem como pendurar um hook.
   */
  t: TranslateFn;
  /**
   * O resolvedor de rótulo DECLARATIVO, pelo mesmo motivo e pela mesma porta. Um provider precisa dele
   * para BUSCAR: comparar a query com `@com.acme.docs/screen.plural` nunca casa com o que a pessoa
   * digita, e era isso que deixava a tela de uma extensão fora do ⌘K.
   */
  label: (value: string | null | undefined, params?: Record<string, unknown>) => string;
}

export interface ICommandPaletteProvider {
  group: string;
  getItems(query: string, context: CommandPaletteAppContext): CommandPaletteItem[];
}
