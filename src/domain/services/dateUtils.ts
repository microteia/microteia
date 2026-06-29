/**
 * dateUtils — operações de data simplificadas.
 * Firebase gerencia timezone automaticamente.
 */

/** Retorna a data de hoje (início do dia local) */
export const today = (): Date => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

/** Normaliza qualquer Date para início do dia (00:00:00) */
export const startOfDay = (date: Date): Date =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

/** Adiciona N dias a uma data */
export const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return startOfDay(result);
};

/** Diferença em dias completos entre duas datas (positivo = `to` é mais recente) */
export const daysBetween = (from: Date, to: Date): number => {
  const a = startOfDay(from).getTime();
  const b = startOfDay(to).getTime();
  return Math.round((b - a) / 86_400_000);
};

/** Formata duração em segundos para exibição legível (ex: "5min", "1h 20min") */
export const formatDuration = (seconds: number): string => {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return s > 0 ? `${m}min ${s}s` : `${m}min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${h}h ${rem}min` : `${h}h`;
};
