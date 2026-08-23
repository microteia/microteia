import type React from 'react';
import type { EntityRecord, ScreenDefinition, UserRole } from '../../../../../domain/entities';
import type { PersonRecord } from '../../../../shared/useCollectionRecords';
import type { WorkflowDefinition } from '../../../../../domain/entities/Workflow';
import type { ThemeOption } from '../../../../../stores/useTheme';
import type { UiPageMetadata } from '../../../../../domain/schema/ui/uiExtensionPoints';
import type { CaseRecord, ContractRecord } from '../../../../shared/useCollectionRecords';
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

export interface CommandPaletteAppContext {
  openTab: (key: string) => void;
  close: () => void;
  persons: PersonRecord[];
  cases: CaseRecord[];
  contracts: ContractRecord[];
  records: EntityRecord[];
  screenDefinitions: ScreenDefinition[];
  workflows: WorkflowDefinition[];
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
