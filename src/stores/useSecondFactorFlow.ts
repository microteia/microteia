import { createContext, useContext } from 'react';

/**
 * Os gestos do PRÓPRIO segundo fator que nascem de dentro do espaço de trabalho — cadastrar por vontade
 * própria, trocar o aplicativo, sortear códigos de recuperação novos. Quem os executa é o
 * `TenantEntryGate`, o mesmo que pede o código na entrada: são os mesmos passos, a mesma tela e as
 * mesmas regras de prova recente, e uma segunda cópia deles divergiria.
 */
export interface SecondFactorFlowValue {
  /** Cadastra o aplicativo — ou o troca, depois de provar o atual. */
  setUp: () => void;
  /** Sorteia códigos novos, depois de provar o fator; os anteriores param de valer. */
  regenerateRecoveryCodes: () => void;
}

export const SecondFactorFlowContext = createContext<SecondFactorFlowValue | null>(null);

export const useSecondFactorFlow = (): SecondFactorFlowValue => {
  const ctx = useContext(SecondFactorFlowContext);
  if (!ctx) throw new Error('useSecondFactorFlow must be used within TenantEntryGate');
  return ctx;
};
