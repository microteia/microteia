import { createContext, useContext } from 'react';
import type { TenantEntryGateViewModel } from './TenantEntryGate.viewmodel';

/**
 * O estado do `TenantEntryGate` para quem o desenha DENTRO do espaço de trabalho. O gate mora acima da
 * pilha de stores — é ele que a impede de montar —, mas o modal que ele abre com a tela aberta precisa
 * do idioma do escritório, que só existe lá dentro (`TenantLocaleProvider`, com os pacotes de tradução
 * instalados). Desenhado no próprio gate, o modal saía sempre no idioma-fonte.
 */
export const TenantEntryGateContext = createContext<TenantEntryGateViewModel | null>(null);

export const useTenantEntryGate = (): TenantEntryGateViewModel => {
  const ctx = useContext(TenantEntryGateContext);
  if (!ctx) throw new Error('useTenantEntryGate must be used within TenantEntryGate');
  return ctx;
};
