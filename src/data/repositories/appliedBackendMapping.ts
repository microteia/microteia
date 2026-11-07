import { toDateValue } from '../utils/toDateValue';
import type { AppliedBackend, AppliedBackendEntry } from '../../domain/entities/AppliedBackend';

/**
 * O documento `backend_state/applied` virando entidade.
 *
 * Defensivo pelo mesmo motivo de `backendResidueMapping`: o Console é versionado à parte do kernel, e o
 * documento pode vir de uma versão anterior ou posterior. Entrada sem id ou sem fingerprint é
 * descartada — ela não libera extensão nenhuma, e o erro aqui só pode ser para o lado fechado.
 */
const asText = (value: unknown): string => (typeof value === 'string' ? value : '');

const asOptionalText = (value: unknown): string | null =>
  (typeof value === 'string' && value !== '' ? value : null);

const asEntries = (value: unknown): AppliedBackendEntry[] => {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): AppliedBackendEntry[] => {
    if (typeof item !== 'object' || item === null) return [];
    const fields = item as Record<string, unknown>;
    const pluginId = asText(fields.pluginId);
    const fingerprint = asText(fields.fingerprint);
    if (pluginId === '' || fingerprint === '') return [];
    return [{
      pluginId,
      fingerprint,
      approvedHash: asOptionalText(fields.approvedHash),
      approvedBy: asOptionalText(fields.approvedBy),
    }];
  });
};

export const appliedBackendFromDoc = (data: Record<string, unknown>): AppliedBackend => ({
  writtenAt: toDateValue(data.writtenAt),
  consoleVersion: asText(data.consoleVersion),
  extensions: asEntries(data.extensions),
});
