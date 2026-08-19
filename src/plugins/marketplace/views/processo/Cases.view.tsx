import { useMemo } from 'react';
import { styled, useTheme } from 'styled-components';
import { RecordListSurface, Badge, InfoBanner } from '@microteia/ui';
import { useCollection, useEntityList, useLookup } from '@microteia/data';
import { getConfigColor } from '@microteia/theme';

const SOURCE_ID = 'microteia:processo';

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

const CaseNumberRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  margin-top: 2px;
  min-width: 0;
`;

const CaseNumber = styled.div`
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.textMuted};
  font-family: ${({ theme }) => theme.fonts.mono};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
`;

const DaysChip = styled.span`
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  margin-left: auto;
  padding: 1px 6px;
  border-radius: ${({ theme }) => theme.borderRadius.full};
  font-size: 10px;
  font-weight: 500;
  font-family: ${({ theme }) => theme.fonts.mono};
  background: ${({ theme }) => theme.colors.surfaceHover};
  color: ${({ theme }) => theme.colors.textMuted};
  border: 1px solid ${({ theme }) => theme.colors.border};
  white-space: nowrap;
`;

const asArray = (v) => Array.isArray(v) ? v : (v == null || v === '' ? [] : [v]);

function daysSince(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(String(value).slice(0, 10) + 'T00:00:00');
  if (isNaN(d.getTime())) return null;
  const diff = Math.floor((Date.now() - d.getTime()) / 86400000);
  return diff < 0 ? 0 : diff;
}

export default function ProcessosView() {
  const theme = useTheme();
  const list = useEntityList(SOURCE_ID);
  const persons = useCollection('persons');
  const statusOptions = useLookup('caseStatuses');
  const phaseOptions = useLookup('casePhases');

  const personById = useMemo(() => {
    const map = {};
    for (const p of persons) map[p.id] = p;
    return map;
  }, [persons]);

  if (!list.definition) {
    return <div style={{ padding: '24px' }}><InfoBanner message='Tela "Processos" não encontrada. Instale a extensão para ativá-la.' variant="warning" /></div>;
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

  const renderSubtitle = (record) => {
    if (!record.caseNumber) return undefined;
    const days = daysSince(record.filedAt);
    return (
      <CaseNumberRow>
        <CaseNumber>{record.caseNumber}</CaseNumber>
        {days != null ? <DaysChip>{days} dias</DaysChip> : null}
      </CaseNumberRow>
    );
  };

  const renderBelowHeader = (record) => {
    const active = namesOf(record.activePoleIds);
    const passive = namesOf(record.passivePoleIds);
    return (
      <>
        <Badges>
          {record.status ? <Badge color={getConfigColor(statusOptions, record.status, theme)}>{record.status}</Badge> : null}
          {record.phase ? <Badge color={getConfigColor(phaseOptions, record.phase, theme)}>{record.phase}</Badge> : null}
        </Badges>
        {active.length > 0 || passive.length > 0 ? (
          <PartesRow>
            {renderPole('Polo Ativo', active, 'left')}
            {renderPole('Polo Passivo', passive, 'right')}
          </PartesRow>
        ) : null}
      </>
    );
  };

  return (
    <RecordListSurface
      vm={list}
      definition={list.definition}
      renderSubtitle={renderSubtitle}
      renderBelowHeader={renderBelowHeader}
      emptyTitle="Nenhum processo encontrado"
      emptyActionLabel="Cadastrar primeiro processo"
    />
  );
}
