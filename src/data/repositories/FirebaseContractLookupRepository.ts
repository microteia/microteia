import { collection, getDocs, orderBy, query, addDoc, deleteDoc, doc, where } from 'firebase/firestore';
import { db } from '../../infrastructure/firebase/config';
import type { IContractLookupRepository } from '../../domain/repositories/IContractLookupRepository';
import type { ContractLookupConfig, ContractLookupKind } from '../../domain/entities';

const COLLECTION_NAMES: Record<ContractLookupKind, string> = {
  types:                     'contractTypes',
  categories:                'contractCategories',
  statuses:                  'contractStatuses',
  objects:                   'contractObjects',
  adjustmentIndexes:         'contractAdjustmentIndexes',
  adjustmentPeriodicities:   'contractAdjustmentPeriodicities',
  currencies:                'contractCurrencies',
  paymentMethods:            'contractPaymentMethods',
  banks:                     'contractBanks',
  costCenters:               'contractCostCenters',
};

const STATIC_DEFAULTS: Record<ContractLookupKind, ContractLookupConfig[]> = {
  types: [
    { key: 'Prestação de serviços',     label: 'Prestação de serviços',     isStatic: true },
    { key: 'Compra e venda',            label: 'Compra e venda',            isStatic: true },
    { key: 'Locação',                   label: 'Locação',                   isStatic: true },
    { key: 'Confissão de dívida',       label: 'Confissão de dívida',       isStatic: true },
    { key: 'Parceria',                  label: 'Parceria',                  isStatic: true },
    { key: 'Fornecimento',              label: 'Fornecimento',              isStatic: true },
    { key: 'Licenciamento',             label: 'Licenciamento',             isStatic: true },
    { key: 'NDA',                       label: 'NDA',                       isStatic: true },
    { key: 'Trabalho',                  label: 'Trabalho',                  isStatic: true },
    { key: 'Honorários advocatícios',   label: 'Honorários advocatícios',   isStatic: true },
    { key: 'Procuração',                label: 'Procuração',                isStatic: true },
    { key: 'Distrato',                  label: 'Distrato',                  isStatic: true },
    { key: 'Acordo',                    label: 'Acordo',                    isStatic: true },
  ],
  categories: [
    { key: 'Cível',                     label: 'Cível',                     isStatic: true },
    { key: 'Empresarial',               label: 'Empresarial',               isStatic: true },
    { key: 'Trabalhista',               label: 'Trabalhista',               isStatic: true },
    { key: 'Imobiliário',               label: 'Imobiliário',               isStatic: true },
    { key: 'Societário',                label: 'Societário',                isStatic: true },
    { key: 'Propriedade Intelectual',   label: 'Propriedade Intelectual',   isStatic: true },
    { key: 'Tecnologia (TI)',           label: 'Tecnologia (TI)',           isStatic: true },
    { key: 'Financeiro',                label: 'Financeiro',                isStatic: true },
    { key: 'Consumidor',                label: 'Consumidor',                isStatic: true },
    { key: 'Administrativo',            label: 'Administrativo',            isStatic: true },
    { key: 'Tributário',                label: 'Tributário',                isStatic: true },
    { key: 'Público',                   label: 'Público',                   isStatic: true },
    { key: 'Agronegócio',               label: 'Agronegócio',               isStatic: true },
    { key: 'Família e Sucessões',       label: 'Família e Sucessões',       isStatic: true },
    { key: 'Outros',                    label: 'Outros',                    isStatic: true },
  ],
  statuses: [
    { key: 'Em elaboração',             label: 'Em elaboração',             color: 'contractStatusDraft',              isStatic: true },
    { key: 'Em revisão',                label: 'Em revisão',                color: 'contractStatusReview',             isStatic: true },
    { key: 'Aguardando assinatura',     label: 'Aguardando assinatura',     color: 'contractStatusAwaitingSignature',  isStatic: true },
    { key: 'Vigente',                   label: 'Vigente',                   color: 'contractStatusActive',             isStatic: true },
    { key: 'Suspenso',                  label: 'Suspenso',                  color: 'contractStatusSuspended',          isStatic: true },
    { key: 'Encerrado',                 label: 'Encerrado',                 color: 'contractStatusClosed',             isStatic: true },
    { key: 'Cancelado',                 label: 'Cancelado',                 color: 'contractStatusCancelled',          isStatic: true },
    { key: 'Rescindido',                label: 'Rescindido',                color: 'contractStatusTerminated',         isStatic: true },
  ],
  objects: [],
  adjustmentIndexes: [
    { key: 'INPC', label: 'INPC', isStatic: true },
    { key: 'IPCA', label: 'IPCA', isStatic: true },
  ],
  adjustmentPeriodicities: [
    { key: 'Anual', label: 'Anual', isStatic: true },
  ],
  currencies: [
    { key: 'Real', label: 'Real', isStatic: true },
  ],
  paymentMethods: [
    { key: 'À vista',            label: 'À vista',            isStatic: true },
    { key: 'À prazo',            label: 'À prazo',            isStatic: true },
    { key: 'Boleto',             label: 'Boleto',             isStatic: true },
    { key: 'Cartão de Crédito',  label: 'Cartão de Crédito',  isStatic: true },
  ],
  banks: [],
  costCenters: [],
};

export class FirebaseContractLookupRepository implements IContractLookupRepository {
  async getAll(tenantId: string, kind: ContractLookupKind): Promise<ContractLookupConfig[]> {
    try {
      const col = collection(db, 'tenants', tenantId, COLLECTION_NAMES[kind]);
      const q = query(col, orderBy('label', 'asc'));
      const snap = await getDocs(q);
      const dynamic = snap.docs.map((d) => ({
        key:      d.data().key   as string,
        label:    d.data().label as string,
        color:    d.data().color as string | undefined,
        isStatic: false,
      }));
      const dynamicKeys = new Set(dynamic.map((a) => a.key));
      const statics = STATIC_DEFAULTS[kind].filter((s) => !dynamicKeys.has(s.key));
      return [...statics, ...dynamic].sort((a, b) => a.label.localeCompare(b.label));
    } catch {
      return STATIC_DEFAULTS[kind];
    }
  }

  async create(tenantId: string, kind: ContractLookupKind, name: string, createdBy: string, color?: string): Promise<ContractLookupConfig> {
    const col = collection(db, 'tenants', tenantId, COLLECTION_NAMES[kind]);
    const data: Record<string, unknown> = { key: name, label: name, createdBy, createdAt: new Date() };
    if (color) data.color = color;
    await addDoc(col, data);
    return { key: name, label: name, color, isStatic: false };
  }

  async delete(tenantId: string, kind: ContractLookupKind, key: string): Promise<void> {
    const col = collection(db, 'tenants', tenantId, COLLECTION_NAMES[kind]);
    const q = query(col, where('key', '==', key));
    const snap = await getDocs(q);
    await Promise.all(snap.docs.map((d) => deleteDoc(doc(col, d.id))));
  }
}
