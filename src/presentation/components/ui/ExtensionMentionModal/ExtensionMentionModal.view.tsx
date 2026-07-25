import React, { useMemo, useState } from 'react';
import { Modal } from '../Modal';
import { Input } from '../Input';
import { S } from './ExtensionMentionModal.styles';
import { useCustomRecords } from '../../../../stores/useCustomRecords';
import { useScreenDefinitions } from '../../../../stores/useScreenDefinitions';
import type { ExtensionMentionProvider, MentionResult } from '../../../shared/extensions/extensionServices';

export interface ExtensionMentionModalProps {
  provider: ExtensionMentionProvider;
  onSelect: (result: MentionResult) => void;
  onClose: () => void;
}

/**
 * Picker genérico de menção de EXTENSÃO: dado o provedor registrado por uma extensão, busca seus
 * registros (com os dados do tenant) e insere um deeplink no texto. Fica em componente próprio para
 * usar os stores com segurança — só monta dentro do contexto do escritório, ao acionar o `@`.
 */
export const ExtensionMentionModal: React.FC<ExtensionMentionModalProps> = ({ provider, onSelect, onClose }) => {
  const { allRecords } = useCustomRecords();
  const { definitions } = useScreenDefinitions();
  const [query, setQuery] = useState('');

  const results = useMemo(
    () => provider.search(query, { customRecords: allRecords, screenDefinitions: definitions }).slice(0, 20),
    [provider, query, allRecords, definitions],
  );

  return (
    <Modal title={provider.label} onClose={onClose} size="small">
      <S.Search>
        <Input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar..."
          autoFocus
        />
      </S.Search>
      <S.List>
        {results.length === 0 ? (
          <S.Empty>Nada encontrado.</S.Empty>
        ) : (
          results.map((result) => (
            <S.Item key={result.id} type="button" onClick={() => onSelect(result)}>
              <S.ItemTitle>{result.title}</S.ItemTitle>
              {result.subtitle ? <S.ItemSub>{result.subtitle}</S.ItemSub> : null}
            </S.Item>
          ))
        )}
      </S.List>
    </Modal>
  );
};
