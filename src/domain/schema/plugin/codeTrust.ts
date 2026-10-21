/**
 * A regra de CONFIANÇA no código de uma extensão — a parte pura dela, que o navegador e o servidor
 * aplicam igual.
 *
 * O servidor passou a precisar dela quando o portal começou a entregar views de extensão: o
 * convidado não lê `installed_extensions`, então quem decide se a view roda é a function — e ela não
 * pode ter uma régua diferente da que o escritório vê na tela de Extensões.
 */

// NUL como separador: não pode aparecer dentro do código, então a serialização é inambígua.
const SEPARATOR = '\u0000';

/**
 * Serialização determinística de TODO o código do pacote. As views são ordenadas por chave para que
 * a mesma extensão produza sempre o mesmo hash, independentemente da ordem no arquivo.
 */
export const extensionCodeOf = (
  pkg: { views?: ReadonlyArray<{ key: string; source: string }> | null; startup?: string | null },
): string | null => {
  const views = [...(pkg.views ?? [])]
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
    .map((view) => `${view.key}${SEPARATOR}${view.source}`);
  const startup = pkg.startup?.trim() ? [`${SEPARATOR}startup${SEPARATOR}${pkg.startup}`] : [];
  const parts = [...views, ...startup];
  return parts.length > 0 ? parts.join(SEPARATOR) : null;
};

/**
 * Procedência OU gesto: veio do catálogo público ou do embutido, ou um admin confiou NESTE código
 * (o hash da confiança é o hash do código de agora). Sem código, a pergunta não se aplica.
 */
export const isCodeTrusted = (
  extension: { source?: unknown; codeTrust?: { hash?: unknown } | null },
  hasCode: boolean,
  currentHash: string | null,
): boolean => {
  if (!hasCode) return true;
  if (extension.source === 'public' || extension.source === 'builtin') return true;
  const trusted = extension.codeTrust?.hash;
  return typeof trusted === 'string' && !!currentHash && trusted === currentHash;
};
