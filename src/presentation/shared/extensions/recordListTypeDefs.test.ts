import { describe, expect, it } from 'vitest';
import { buildExtensionTypeDefs } from './extensionTypeDefs';
import type { RecordListViewModel } from '../entityScreen/useRecordListViewModel';

/**
 * O que `useEntityList` devolve, como o autor de extensão o LÊ. A declaração tinha `[key: string]: any`
 * e dois nomes que não existiam (`filters`, `setFilters`): um nome errado passava no `tsc` do autor e
 * virava `undefined` na tela. O `Record<keyof …>` abaixo fecha por tipo — um campo novo no view model
 * não compila até entrar aqui —, e o teste cobra que a declaração publicada diga exatamente os mesmos.
 */
const MEMBERS: Record<keyof RecordListViewModel, true> = {
  definition: true, collection: true, isAvailable: true, isLoading: true, records: true,
  filteredRecords: true, filterTokens: true, filterDefs: true, savedFiltersScreenKey: true, tags: true,
  setFilterTokens: true, canRead: true, canCreate: true, canUpdate: true, canDeleteRecords: true,
  openNewRecord: true, openRecord: true, getCardItems: true, getCardTitle: true, getCardSubtitle: true,
  cardSubtitleIconKey: true,
  getFieldText: true, getCardImageUrl: true, getCardActions: true, parameterPrompt: true,
  pendingCardAction: true, confirmPendingCardAction: true, cancelPendingCardAction: true, tagAdapter: true,
  tagManagerRecord: true, closeTagManager: true, recordToDelete: true, cancelDelete: true,
  confirmDelete: true, isDeleting: true, recordImport: true,
};

const declaredMembers = (): string[] => {
  const defs = buildExtensionTypeDefs();
  const start = defs.indexOf('export interface RecordListViewModel {');
  const body = defs.slice(start, defs.indexOf('\n  }', start));
  return [...body.matchAll(/^ {4}(\w+)\s*:/gm)].map((match) => match[1]);
};

describe('o view model da lista, como a extensão o enxerga', () => {
  it('declara cada campo do view model real, e nenhum outro', () => {
    expect(declaredMembers().sort()).toEqual(Object.keys(MEMBERS).sort());
  });

  it('não aceita mais qualquer chave', () => {
    const defs = buildExtensionTypeDefs();
    const start = defs.indexOf('export interface RecordListViewModel {');
    expect(defs.slice(start, defs.indexOf('\n  }', start))).not.toContain('[key: string]');
  });
});
