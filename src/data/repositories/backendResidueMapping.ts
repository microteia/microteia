import { toDateValue } from '../utils/toDateValue';
import type { BackendResidue, OrphanFunction } from '../../domain/entities/BackendResidue';

/**
 * O documento `backend_state/current` virando entidade.
 *
 * A leitura é DEFENSIVA de ponta a ponta, e não por precaução: o Microteia Console é versionado e
 * distribuído à parte do kernel, então este documento pode ter sido escrito por um Console anterior (sem
 * um campo) ou posterior (com campos que ninguém aqui conhece). O que falta vira vazio; o que sobra é
 * ignorado.
 *
 * A alternativa é uma tela que estoura por causa de um campo — e o que ela iria mostrar era um aviso.
 *
 * Fica separado do repositório pelo mesmo motivo que `pluginRegistryMapping`: assim a conversão se testa
 * sem subir o Firebase, que é a única parte dela que pode estar errada.
 */
const asCount = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0;

const asText = (value: unknown): string => (typeof value === 'string' ? value : '');

const asOrphanFunctions = (value: unknown): OrphanFunction[] => {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry): OrphanFunction[] => {
    if (typeof entry !== 'object' || entry === null) return [];
    const fields = entry as Record<string, unknown>;
    const name = asText(fields.name);
    if (name === '') return [];
    const owner = asText(fields.owner);
    return [{ name, owner: owner === '' ? null : owner }];
  });
};

const asTextList = (value: unknown): string[] => (Array.isArray(value) ? value : [])
  .filter((entry): entry is string => typeof entry === 'string' && entry !== '');

export const backendResidueFromDoc = (data: Record<string, unknown>): BackendResidue => ({
  scannedAt: toDateValue(data.scannedAt),
  consoleVersion: asText(data.consoleVersion),
  tenants: asCount(data.tenants),
  extensions: asCount(data.extensions),
  orphanFunctions: asOrphanFunctions(data.orphanFunctions),
  orphanIndexes: asTextList(data.orphanIndexes),
});
