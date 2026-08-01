/**
 * O IDENTIFICADOR de uma automação — o que uma Ação guarda em `workflowId` e o que um pacote
 * referencia. Nasceu como id gerado pelo banco, ilegível e invisível na tela: quem montava uma Ação
 * não tinha como saber qual automação estava escolhendo pelo id, e um pacote só conseguia apontar
 * para ela pelo `templateId`.
 *
 * Passa a ser um nome, no mesmo espírito das chaves de tela: minúsculas, dígitos e hífen, começando
 * por letra. Curto o bastante para caber numa referência e estável o bastante para ser escrito à mão.
 */
const WORKFLOW_ID_PATTERN = /^[a-z][a-z0-9-]*$/;

export const MAX_WORKFLOW_ID_LENGTH = 60;

export const workflowIdIssue = (id: string, taken: ReadonlySet<string> = new Set()): string | undefined => {
  const trimmed = id.trim();
  if (!trimmed) return 'Informe o identificador';
  if (trimmed.length > MAX_WORKFLOW_ID_LENGTH) {
    return `O identificador deve ter no máximo ${MAX_WORKFLOW_ID_LENGTH} caracteres`;
  }
  if (!WORKFLOW_ID_PATTERN.test(trimmed)) {
    return 'Use apenas letras minúsculas, números e hífen, começando por letra (ex: "avisar-cliente")';
  }
  if (taken.has(trimmed)) return `Já existe uma automação com o identificador "${trimmed}"`;
  return undefined;
};

/**
 * O identificador derivado do NOME, para quem não quer escolher um: acentos viram a letra base,
 * o resto que não é letra ou dígito vira hífen, e o que sobrar entra em minúsculas.
 *
 * `taken` desempata com sufixo numérico, como o resto da plataforma faz com nomes de coleção — dois
 * "Avisar cliente" viram `avisar-cliente` e `avisar-cliente-2`.
 */
export const deriveWorkflowId = (name: string, taken: ReadonlySet<string> = new Set()): string => {
  const base = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_WORKFLOW_ID_LENGTH);

  // Nome só de símbolos, ou começando por número, não produz um identificador válido sozinho.
  const seed = WORKFLOW_ID_PATTERN.test(base) ? base : `wf-${base}`.replace(/-+$/, '');
  if (!taken.has(seed)) return seed;

  // O desempate é com hífen, e não com sublinhado: o sublinhado não passa na própria validação.
  let suffix = 2;
  while (taken.has(`${seed}-${suffix}`)) suffix += 1;
  return `${seed}-${suffix}`;
};
