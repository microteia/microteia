/**
 * As validades que as duas telas de autorização de agente oferecem.
 *
 * Num `.ts` à parte porque é compartilhado entre a aba de Agentes de IA e o consentimento de OAuth,
 * e um `.tsx` de ViewModel que também exporte constante dispara `react-refresh/only-export-components`.
 * Chave de catálogo no rótulo, dias no valor: a frase nasce em inglês no catálogo, nunca aqui.
 */
export const AGENT_EXPIRY_CHOICES: { days: number | null; labelKey: string }[] = [
  { days: 30, labelKey: 'agent.expiry.30' },
  { days: 90, labelKey: 'agent.expiry.90' },
  { days: 365, labelKey: 'agent.expiry.365' },
  { days: null, labelKey: 'agent.expiry.never' },
];

export const AGENT_DEFAULT_EXPIRY_DAYS = 90;
