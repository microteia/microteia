import { createContext, useContext } from 'react';
import type { Tenant, TenantMember, TenantUpdate } from '../domain/entities';

export interface TenantContextValue {
  currentTenant: Tenant | null;
  availableTenants: Tenant[];
  members: TenantMember[];
  isLoading: boolean;
  initError: string | null;
  /** A pessoa não é membro de escritório nenhum, só convidada de portal — o lugar dela é `/portal`. */
  portalOnly: boolean;
  selectTenant: (tenantId: string) => Promise<void>;
  updateTenant: (data: TenantUpdate) => Promise<void>;
  addMember: (member: Omit<TenantMember, 'addedAt' | 'permissions'>) => Promise<void>;
  updateMemberRoles: (userId: string, roleIds: string[]) => Promise<void>;
  removeMember: (userId: string) => Promise<void>;
  refreshMembers: () => Promise<void>;
}

export const TenantContext = createContext<TenantContextValue | null>(null);

export const useTenant = (): TenantContextValue => {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error('useTenant must be used within TenantStoreProvider');
  return ctx;
};
