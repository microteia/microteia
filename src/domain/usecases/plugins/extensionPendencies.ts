/**
 * Por que uma extensão instalada pede a atenção de quem administra o escritório.
 *
 * A ordem é a de leitura na tela: primeiro o que a impede de funcionar, por último o que só a deixa
 * desatualizada. Cada motivo é um gesto diferente — atualizar, instalar a dependência, rodar o
 * `provision`, rodar a migração, revisar o código —, e é por isso que eles não viram um booleano só.
 */
export const EXTENSION_PENDENCIES = ['load-failed', 'backend', 'migration', 'code-review', 'update'] as const;

export type ExtensionPendency = (typeof EXTENSION_PENDENCIES)[number];

/** O que já se sabe da cópia instalada, cada fato vindo da fonte que responde por ele. */
export interface ExtensionPendencyFacts {
  active: boolean;
  /** O Kernel recusou a extensão ao montar o escritório (diagnóstico de severidade `error`). */
  loadFailed: boolean;
  /** Exige do projeto Firebase o que o Microteia Console ainda não criou. */
  backendPending: boolean;
  /** Tem migração de dados obrigatória em dívida. */
  migrationPending: boolean;
  /** Traz código que ainda não pode executar — falta a revisão de um admin. */
  codeAwaitingReview: boolean;
  updateAvailable: boolean;
}

const HOLDS: Record<ExtensionPendency, (facts: ExtensionPendencyFacts) => boolean> = {
  'load-failed': (facts) => facts.loadFailed,
  backend: (facts) => facts.backendPending,
  migration: (facts) => facts.migrationPending,
  'code-review': (facts) => facts.codeAwaitingReview,
  update: (facts) => facts.updateAvailable,
};

/**
 * As pendências de uma cópia instalada.
 *
 * Desligada não deve nada: ela não faz coisa alguma no escritório, e cobrar atenção por ela seria
 * pedir um gesto que não muda nada — quem a desligou já decidiu. É a mesma régua que o selo de
 * atualização sempre usou, agora estendida a todos os motivos.
 *
 * Está no domínio porque a resposta é a MESMA em três lugares que não se conhecem — o selo do menu, o
 * atalho do alto da tela e a aba "Pendentes" de Extensões —, e um número que discordasse da lista que
 * ele abre seria pior do que número nenhum.
 */
export const extensionPendencies = (facts: ExtensionPendencyFacts): ExtensionPendency[] =>
  facts.active ? EXTENSION_PENDENCIES.filter((pendency) => HOLDS[pendency](facts)) : [];
