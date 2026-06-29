import type React from 'react';
import type { News, Person, Case, TenantRole, UserRole } from '../../../../../domain/entities';
import type { ThemeMode } from '../../../../../shared/types';

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
  persons: Person[];
  cases: Case[];
  mode: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
  signOut: () => Promise<void>;
  userRole: UserRole | null;
  tenantRole: TenantRole | null;
}

export interface ICommandPaletteProvider {
  group: string;
  getItems(query: string, context: CommandPaletteAppContext): CommandPaletteItem[];
}
