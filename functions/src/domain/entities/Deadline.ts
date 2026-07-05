export type DeadlinePriority = 'Baixa' | 'Média' | 'Alta' | 'Crítica';

/**
 * Shape mínimo, duplicado à mão a partir de src/domain/entities/index.ts (Deadline) — só os
 * campos que CreateDeadlineStep precisa gravar. functions/ e src/ não compartilham código.
 */
export interface DeadlineToCreate {
  caseId: string;
  description?: string | null;
  dueDate: Date;
  type: string;
  priority: DeadlinePriority;
  responsibleLawyerId?: string | null;
  createdBy: string;
}
