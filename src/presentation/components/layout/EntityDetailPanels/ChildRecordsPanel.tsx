import React from 'react';
import { RiAddLine, RiExternalLinkLine } from 'react-icons/ri';
import { S } from './panels.styles';
import { Button } from '../../ui/Button';
import { useCustomFieldListing } from '../../../hooks/useCustomFieldListing';
import { sortFieldsByOrder } from '../../../../domain/services/customFieldValues';
import { getScreenIcon } from '../../../shared/screenIcons';
import type { CustomRecord, ScreenDefinition } from '../../../../domain/entities';

interface ChildRecordsPanelProps {
  screen: ScreenDefinition;
  records: CustomRecord[];
  onOpen: (record: CustomRecord) => void;
  onNew: () => void;
}

/**
 * Lista os registros de uma tela FILHA dentro do registro pai. O resumo de cada linha reusa o
 * mesmo `useCustomFieldListing` da listagem dinâmica, então respeita o "Exibir na listagem" de
 * cada campo.
 */
export const ChildRecordsPanel: React.FC<ChildRecordsPanelProps> = ({ screen, records, onOpen, onNew }) => {
  const listing = useCustomFieldListing(screen.id, sortFieldsByOrder(screen.fields));

  return (
    <>
      <S.TabSectionHeader>
        <Button variant="secondary" size="sm" onClick={onNew}>
          <RiAddLine size={14} />
          {`Novo ${screen.titleSingular}`}
        </Button>
      </S.TabSectionHeader>

      {records.length === 0 ? (
        <S.EmptyState>
          <S.EmptyIcon>{getScreenIcon(screen.icon)}</S.EmptyIcon>
          <div>{`Nenhum registro de ${screen.titlePlural.toLowerCase()} ainda.`}</div>
        </S.EmptyState>
      ) : (
        <S.DocList>
          {records.map((record) => {
            const summary = listing.cardItems(record.values)
              .filter((item) => item.key !== screen.titleFieldKey && item.value !== '')
              .map((item) => item.value)
              .join(' · ');
            return (
              <S.DocRow key={record.id}>
                <S.DocIcon>{getScreenIcon(screen.icon)}</S.DocIcon>
                <S.DocContent>
                  <S.DocName>{record.title}</S.DocName>
                  {summary && <S.DocMeta>{summary}</S.DocMeta>}
                </S.DocContent>
                <S.DocActions>
                  <Button variant="ghost" size="sm" onClick={() => onOpen(record)} title="Abrir registro">
                    <RiExternalLinkLine size={14} />
                  </Button>
                </S.DocActions>
              </S.DocRow>
            );
          })}
        </S.DocList>
      )}
    </>
  );
};
