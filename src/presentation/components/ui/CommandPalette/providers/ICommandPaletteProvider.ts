import type React from 'react';
import type { News, Contract, Financial, EntityRecord, ScreenDefinition, TenantRole, UserRole } from '../../../../../domain/entities';
import type { PersonRecord } from '../../../../shared/useCollectionRecords';
import type { WorkflowDefinition } from '../../../../../domain/entities/Workflow';
import type { ThemeMode } from '../../../../../shared/types';
import type { UiPageMetadata } from '../../../../shared/uiExtensionPoints';
import type { CaseRecord } from '../../../../shared/useCollectionRecords';

export interface CommandPaletteItem {
  id: string;
  title: string;
  subtitle?: string;
  group: string;
  icon?: React.ReactNode;
  onSelect: () => void;
  keywords?: string[];
}

export interface CommandPaletteAppContext {
  openTab: (key: string) => void;
  close: () => void;
  news: News[];
  persons: PersonRecord[];
  cases: CaseRecord[];
  contracts: Contract[];
  financials: Financial[];
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
}

export interface ICommandPaletteProvider {
  group: string;
  getItems(query: string, context: CommandPaletteAppContext): CommandPaletteItem[];
}
