/**
 * Contrato de dados para um futuro SubWorkflowStep (composição: um workflow chamando outro).
 * Nunca registrado no StepRegistry nesta versão.
 */
export interface SubWorkflowStepShape {
  subWorkflowDefinitionId: string;
}
