/**
 * Contrato de dados para um futuro DelayStep (pausa a execução por um período ou até uma
 * data). Nunca registrado no StepRegistry nesta versão.
 */
export interface DelayStepShape {
  durationMs?: number;
  resumeAt?: Date;
}
