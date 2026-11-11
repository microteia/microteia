import type { DefaultTheme } from 'styled-components';
import type { ReportHighlightTone } from '../../../domain/schema/report/reportSpec';

/**
 * O fundo de uma célula realçada (`presentation.highlight`).
 *
 * Tom do TEMA, nunca cor do relatório: o mesmo "negativo" precisa ler bem no tema claro, no escuro e
 * no que um escritório escrever amanhã. Uma função só, porque a tabela e o pivô pintam a mesma
 * afirmação e não podem discordar sobre a cor dela.
 */
export const reportToneBackground = (theme: DefaultTheme, tone: ReportHighlightTone | undefined): string => {
  if (tone === 'positive') return theme.colors.revenueLight;
  if (tone === 'warning') return theme.colors.warningLight;
  if (tone === 'negative') return theme.colors.dangerLight;
  return 'transparent';
};
