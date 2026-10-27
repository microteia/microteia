import { createContext, useContext } from 'react';
import type { Tenant, TenantMember, TenantUpdate } from '../domain/entities';
import type { MemberMfaRequirement } from '../domain/schema/memberMfa';

/**
 * O segundo fator na ENTRADA do escritório corrente. `requirement` é o que o escritório exige desta
 * pessoa (o próprio documento de membro, ao vivo); `verifiedAt`, quando ESTA sessão o provou.
 */
export interface TenantSecondFactor {
  tenantId: string;
  requirement: MemberMfaRequirement | null;
  verifiedAt: number | null;
}

export interface TenantContextValue {
  currentTenant: Tenant | null;
  availableTenants: Tenant[];
  members: TenantMember[];
  isLoading: boolean;
  initError: string | null;
  /** A pessoa não é membro de escritório nenhum, só convidada de portal — o lugar dela é `/portal`. */
  portalOnly: boolean;
  /**
   * A conta não participa de escritório nenhum — a instalação desligou o autocadastro, ou ela foi
   * removida de todos. Não é falha: é esperar ser adicionada.
   */
  awaitingOrganization: boolean;
  secondFactor: TenantSecondFactor | null;
  /** Abre a sessão que o servidor emitiu depois do código e libera o escritório. */
  completeSecondFactor: (token: string) => Promise<void>;
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
