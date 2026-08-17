import { createContext, useContext } from 'react';
import type { Tenant, TenantMember, TenantRole, TenantUpdate } from '../domain/entities';

export interface TenantContextValue {
  currentTenant: Tenant | null;
  availableTenants: Tenant[];
  tenantRole: TenantRole | null;
  members: TenantMember[];
  isLoading: boolean;
  initError: string | null;
  selectTenant: (tenantId: string) => Promise<void>;
  updateTenant: (data: TenantUpdate) => Promise<void>;
  addMember: (member: Omit<TenantMember, 'addedAt'>) => Promise<void>;
  updateMemberRole: (userId: string, role: TenantRole) => Promise<void>;
  removeMember: (userId: string) => Promise<void>;
  refreshMembers: () => Promise<void>;
}

export const TenantContext = createContext<TenantContextValue | null>(null);

export const useTenant = (): TenantContextValue => {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error('useTenant must be used within TenantStoreProvider');
  return ctx;
};
