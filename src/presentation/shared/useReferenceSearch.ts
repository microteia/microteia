import { useCallback, useMemo, useState } from 'react';
import { MEMBER_REFERENCE_ENTITY } from '../../domain/schema/memberVisibility';
import { RECORD_SEARCH_MAX_RESULTS } from '../../domain/schema/recordSearch';
import { useServerRecordSearch } from './useServerRecordSearch';

const NONE: ReadonlySet<string> = new Set();

export interface ReferenceSearch {
  /** O texto que a pessoa digitou na busca de um seletor — `slot` é quem pergunta (a chave do campo). */
  onQuery: (slot: string, collection: string | null | undefined, text: string) => void;
  /** Os ids que o servidor achou para o texto atual DAQUELE seletor; os outros recebem o conjunto vazio. */
  matchesFor: (slot: string) => ReadonlySet<string>;
}

/**
 * A busca no servidor por trás dos seletores de referência de uma tela. Um seletor aberto por vez é o
 * que a tela permite, e por isso é uma consulta só: a do campo em que a pessoa está digitando. O que
 * volta passa a ser conhecido pelo `RecordStore`, e é por isso que vira opção — este gancho só diz
 * quais opções valem mesmo sem o rótulo conter o texto.
 *
 * Membro não é coleção de registro: a lista de membros do escritório já está inteira na memória.
 */
export const useReferenceSearch = (): ReferenceSearch => {
  const [active, setActive] = useState<{ slot: string; collection: string; text: string } | null>(null);

  const collection = active?.collection ?? null;
  const collections = useMemo(
    () => (collection && collection !== MEMBER_REFERENCE_ENTITY ? [collection] : []),
    [collection],
  );
  const { results } = useServerRecordSearch(active?.text ?? '', collections, RECORD_SEARCH_MAX_RESULTS);
  const ids = useMemo(() => new Set(results.map((record) => record.id)), [results]);

  const onQuery = useCallback((slot: string, target: string | null | undefined, text: string) => {
    setActive(text.trim() !== '' && target ? { slot, collection: target, text } : null);
  }, []);

  const activeSlot = active?.slot ?? null;
  const matchesFor = useCallback((slot: string) => (slot === activeSlot ? ids : NONE), [activeSlot, ids]);

  // Estável enquanto nada muda: quem o põe numa lista de dependências não recalcula a cada render.
  return useMemo(() => ({ onQuery, matchesFor }), [onQuery, matchesFor]);
};
