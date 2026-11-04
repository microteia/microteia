import React, { useMemo, useState } from 'react';
import { Modal } from '../Modal';
import { Input } from '../Input';
import { S } from './ExtensionMentionModal.styles';
import { useRecords } from '../../../../stores/useRecords';
import { useRecordDemand } from '../../../../stores/useRecordDemand';
import { screenDataCollection } from '../../../../domain/services/screenDataCollection';
import { useScreenDefinitions } from '../../../../stores/useScreenDefinitions';
import type { ExtensionMentionProvider, MentionResult } from '../../../shared/extensions/extensionServices';

import { useT } from '../../../shared/i18n/useT';

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
  const t = useT('core.ui');
  const { allRecords } = useRecords();
  const { definitions } = useScreenDefinitions();
  const [query, setQuery] = useState('');
  // O provedor da extensão busca nos registros em memória: enquanto o seletor está aberto, as
  // coleções das telas ficam assinadas, como ficavam sempre antes da carga sob demanda.
  const mentionCollections = useMemo(
    () => definitions.filter((definition) => definition.origin !== 'builtin').map(screenDataCollection),
    [definitions],
  );
  useRecordDemand(mentionCollections);

  const results = useMemo(
    () => provider.search(query, { records: allRecords, screenDefinitions: definitions }).slice(0, 20),
    [provider, query, allRecords, definitions],
  );

  return (
    <Modal title={provider.label} onClose={onClose} size="small">
      <S.Search>
        <Input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('action.search')}
          autoFocus
        />
      </S.Search>
      <S.List>
        {results.length === 0 ? (
          <S.Empty>{t('search.nothing-found')}</S.Empty>
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
