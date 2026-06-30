export interface Tenant {
  id: string;
  name: string;
  ownerId: string;
  cnpj?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  logoURL?: string | null;
  allowedSenders?: string[];
  createdAt: Date;
  updatedAt: Date;
}
