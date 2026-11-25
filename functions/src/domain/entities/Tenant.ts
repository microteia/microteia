export interface Tenant {
  id: string;
  name: string;
  ownerId: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  logoURL?: string | null;
  allowedSenders?: string[];
  allowedSubjects?: string[];
  /** Id de um documento de `plans`, ou `null` — o escritório sem plano, sem restrição nenhuma. */
  plan: string | null;
  memberLimit: number | null;
  memberCount: number;
  /** As atualizações de acesso que o escritório já recebeu. Ver `ACCESS_UPGRADES`. */
  accessUpgrades?: string[];
  createdAt: Date;
  updatedAt: Date;
}
