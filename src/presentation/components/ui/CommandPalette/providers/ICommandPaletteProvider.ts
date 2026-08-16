import type React from 'react';
import type { EntityRecord, ScreenDefinition, TenantRole, UserRole } from '../../../../../domain/entities';
import type { PersonRecord } from '../../../../shared/useCollectionRecords';
import type { WorkflowDefinition } from '../../../../../domain/entities/Workflow';
import type { ThemeMode } from '../../../../../shared/types';
import type { UiPageMetadata } from '../../../../shared/uiExtensionPoints';
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
  mode: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
  signOut: () => Promise<void>;
  userRole: UserRole | null;
  tenantRole: TenantRole | null;
  /** Telas abríveis, já filtradas por papel — vêm das contribuições `ui.page` dos plugins. */
  navigablePages: UiPageMetadata[];
  /**
   * O tradutor do `core.ui`. Ele entra no CONTEXTO porque um provider não é componente — `getItems`
   * é função pura, chamada a cada tecla, e não tem como pendurar um hook.
   */
  t: TranslateFn;
}

export interface ICommandPaletteProvider {
  group: string;
  getItems(query: string, context: CommandPaletteAppContext): CommandPaletteItem[];
}
