import { useMemo } from 'react';
import { styled, useTheme } from 'styled-components';
import { RecordListSurface, Badge, Icon, InfoBanner } from '@microteia/ui';
import { useCollection, useEntityList, useLookup } from '@microteia/data';
import { getConfigColor } from '@microteia/theme';
import { formatDate } from '@microteia/format';

const SOURCE_ID = 'microteia:contrato';

const Badges = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.xs};
  align-items: center;
`;

const PartesRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  overflow: hidden;
  font-size: ${({ theme }) => theme.fontSizes.xs};
`;

const PoleColumn = styled.div`
  padding: ${({ theme }) => theme.spacing.xs + ' ' + theme.spacing.sm};
  display: flex;
  flex-direction: column;
  gap: 2px;
  border-right: ${({ $side, theme }) => $side === 'left' ? '1px solid ' + theme.colors.border : 'none'};
  min-width: 0;
`;

const PoleLabel = styled.div`
  font-size: 10px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textMuted};
  letter-spacing: 0.05em;
  margin-bottom: 1px;
`;

const PoleName = styled.div`
  color: ${({ theme }) => theme.colors.text};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: ${({ theme }) => theme.fontSizes.xs};
`;

const PoleEmpty = styled.div`
  color: ${({ theme }) => theme.colors.textMuted};
  font-style: italic;
  font-size: ${({ theme }) => theme.fontSizes.xs};
`;

const asArray = (v) => Array.isArray(v) ? v : (v == null || v === '' ? [] : [v]);

export default function ContratosView() {
  const theme = useTheme();
  const list = useEntityList(SOURCE_ID);
  const persons = useCollection('persons');
  const statusOptions = useLookup('contractStatuses');

  const personById = useMemo(() => {
    const map = {};
    for (const p of persons) map[p.id] = p;
    return map;
  }, [persons]);

  if (!list.definition) {
    return <div style={{ padding: '24px' }}><InfoBanner message='Tela "Contratos" não encontrada. Instale a extensão para ativá-la.' variant="warning" /></div>;
  }

  const namesOf = (ids) => asArray(ids).map((id) => personById[id] ? personById[id].name : '').filter(Boolean);

  const renderPole = (label, names, side) => (
    <PoleColumn $side={side}>
      <PoleLabel>{label}</PoleLabel>
      {names.length > 0
        ? names.map((n, i) => <PoleName key={i}>{n}</PoleName>)
        : <PoleEmpty>—</PoleEmpty>}
    </PoleColumn>
  );

  const renderBelowHeader = (record) => {
    const contractors = namesOf(record.contractorIds);
    const contractees = namesOf(record.contracteeIds);
    return (
      <>
        <Badges>
          {record.status ? <Badge color={getConfigColor(statusOptions, record.status, theme)}>{record.status}</Badge> : null}
          {record.type ? <Badge>{record.type}</Badge> : null}
        </Badges>
        {contractors.length > 0 || contractees.length > 0 ? (
          <PartesRow>
            {renderPole('Contratante', contractors, 'left')}
            {renderPole('Contratado', contractees, 'right')}
          </PartesRow>
        ) : null}
      </>
    );
  };

  // A vigência é início – fim numa linha só: separadas, as duas datas ficariam sem sentido no cartão.
  const renderMetaRows = (record) => {
    if (!record.effectiveStart && !record.effectiveEnd) return [];
    const from = record.effectiveStart ? formatDate(record.effectiveStart) : '—';
    const to = record.effectiveEnd ? formatDate(record.effectiveEnd) : '—';
    return [{ key: 'vigencia', icon: <Icon name="calendar" size={12} />, value: from + ' – ' + to }];
  };

  return (
    <RecordListSurface
      vm={list}
      definition={list.definition}
      renderBelowHeader={renderBelowHeader}
      renderMetaRows={renderMetaRows}
      emptyTitle="Nenhum contrato encontrado"
      emptyActionLabel="Cadastrar primeiro contrato"
    />
  );
}
