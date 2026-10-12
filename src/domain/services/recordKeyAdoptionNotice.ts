import type { RecordKeyAdoptionIssue, RecordKeyAdoptionState } from '../schema/recordKeyAdoption';

/**
 * O que a listagem de uma tela diz a quem a administra sobre a adoção das chaves dela.
 *
 * Diferente do recálculo de agregados, aqui há um GESTO, e ele é da pessoa: uma duplicata antiga não
 * se resolve sozinha — alguém decide qual dos dois registros fica com o valor. O aviso diz quais
 * valores se repetem (é o que se procura na lista) e que a chave passa a valer sozinha quando eles
 * deixarem de se repetir. Não há botão: corrigir o registro é o gesto, e é ele que reconfere.
 */
export interface RecordKeyAdoptionNotice {
  /** Chave no catálogo `core.records`. */
  messageKey: string;
  params: Record<string, string>;
  variant: 'info' | 'warning';
}

/** Quantos valores repetidos o aviso cita; o resto vira reticência. */
export const NOTICE_MAX_VALUES = 5;

const listValues = (issues: readonly RecordKeyAdoptionIssue[]): string => {
  const values = [...new Set(issues.map((issue) => issue.values.join(' + ')))];
  const shown = values.slice(0, NOTICE_MAX_VALUES).join(', ');
  return values.length > NOTICE_MAX_VALUES ? `${shown}, …` : shown;
};

const byKey = (issues: readonly RecordKeyAdoptionIssue[]): Map<string, RecordKeyAdoptionIssue[]> => {
  const grouped = new Map<string, RecordKeyAdoptionIssue[]>();
  for (const issue of issues) grouped.set(issue.key, [...(grouped.get(issue.key) ?? []), issue]);
  return grouped;
};

export const recordKeyAdoptionNotices = (
  state: RecordKeyAdoptionState | null,
  keyLabel: (name: string) => string,
): RecordKeyAdoptionNotice[] => {
  if (!state || Object.keys(state.pending).length === 0) return [];
  const pendingLabels = Object.keys(state.pending).map(keyLabel).join(', ');

  if (state.status === 'blocked') {
    return state.blocked.map((entry) => ({
      messageKey: 'key.adoption.blocked',
      params: { key: keyLabel(entry.key), preset: entry.preset },
      variant: 'warning' as const,
    }));
  }

  if (state.status === 'running') {
    return [{
      messageKey: 'key.adoption.running',
      params: { keys: pendingLabels, count: String(state.processed) },
      variant: 'info',
    }];
  }

  const notices: RecordKeyAdoptionNotice[] = [];
  for (const [name, issues] of byKey(state.issues)) {
    const duplicates = issues.filter((issue) => issue.kind === 'duplicate');
    const missing = issues.filter((issue) => issue.kind === 'missing');
    if (duplicates.length > 0) {
      notices.push({
        messageKey: 'key.adoption.duplicates',
        params: { key: keyLabel(name), values: listValues(duplicates) },
        variant: 'warning',
      });
    }
    if (missing.length > 0) {
      notices.push({
        messageKey: 'key.adoption.missing',
        params: { key: keyLabel(name), count: String(missing.length) },
        variant: 'warning',
      });
    }
  }

  if (state.failed > 0) {
    notices.push({
      messageKey: 'key.adoption.failed',
      params: { keys: pendingLabels, count: String(state.failed) },
      variant: 'warning',
    });
  }

  return notices;
};
