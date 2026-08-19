import { useMemo } from 'react';
import { styled, useTheme } from 'styled-components';
import { Icon, RecordListSurface, InfoBanner } from '@microteia/ui';
import { useEntityList, useCollection, useLookup, useOpenRecord } from '@microteia/data';
import { getConfigColor } from '@microteia/theme';

const SOURCE_ID = 'microteia:prazo';

const CaseRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  margin-top: 2px;
  min-width: 0;
`;

const CaseNumber = styled.button`
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.textMuted};
  font-family: ${({ theme }) => theme.fonts.mono};
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
  transition: ${({ theme }) => theme.transitions.fast};

  &:hover { color: ${({ theme }) => theme.colors.primary}; text-decoration: underline; }
`;

const DaysChip = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
  margin-left: auto;
  padding: 1px 7px;
  border-radius: ${({ theme }) => theme.borderRadius.full};
  font-size: 10px;
  font-weight: 600;
  font-family: ${({ theme }) => theme.fonts.mono};
  white-space: nowrap;
  background: ${({ $tone, theme }) => $tone ? theme.colors[$tone] + '20' : theme.colors.surfaceHover};
  color: ${({ $tone, theme }) => $tone ? theme.colors[$tone] : theme.colors.textMuted};
  border: 1px solid ${({ $tone, theme }) => $tone ? theme.colors[$tone] + '44' : theme.colors.border};
`;

const Badges = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  overflow: hidden;
`;

const MetaBadge = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 1px 6px;
  border-radius: ${({ theme }) => theme.borderRadius.full};
  font-size: 10px;
  font-weight: 500;
  background: ${({ $color }) => $color + '20'};
  color: ${({ $color }) => $color};
  border: 1px solid ${({ $color }) => $color + '40'};
  flex-shrink: 0;
`;

const dateOf = (value) => {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(String(value));
  return isNaN(d.getTime()) ? null : d;
};

const startOfDay = (date) => {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

const daysUntilDue = (record) => {
  const due = dateOf(record.dueDate);
  if (!due) return null;
  return Math.round((startOfDay(due).getTime() - startOfDay(new Date()).getTime()) / 86400000);
};

// Vencido é comparação de DIA, não de instante: um prazo gravado por automação nasce à meia-noite,
// e comparar por instante o marcaria como vencido às 00h01 do próprio dia — "0d vencido" onde o
// cartão deve dizer "Hoje". É a mesma unidade que daysUntilDue usa.
const isOverdue = (record) => {
  const due = dateOf(record.dueDate);
  return record.status === 'Pendente' && !!due && startOfDay(due).getTime() < startOfDay(new Date()).getTime();
};

const PRIORITY_ORDER = { 'Crítica': 3, 'Alta': 2, 'Média': 1, 'Baixa': 0 };

/**
 * A lista de prazos se lê do vencimento mais PRÓXIMO ao mais distante — é uma agenda, não um
 * cadastro —, e o empate do dia se desfaz pela prioridade. Fora do componente de propósito: um
 * comparador novo a cada render reordenaria a lista inteira sem que nada tivesse mudado.
 */
const byDueDateThenPriority = (a, b) => {
  const at = dateOf(a.dueDate) ? dateOf(a.dueDate).getTime() : Infinity;
  const bt = dateOf(b.dueDate) ? dateOf(b.dueDate).getTime() : Infinity;
  if (at !== bt) return at - bt;
  const ap = PRIORITY_ORDER[a.priority] != null ? PRIORITY_ORDER[a.priority] : -1;
  const bp = PRIORITY_ORDER[b.priority] != null ? PRIORITY_ORDER[b.priority] : -1;
  return bp - ap;
};

// A visão útil de quem abre Prazos é o que ainda está de pé: sem isso, a primeira tela é o histórico
// inteiro do escritório, com os concluídos misturados aos pendentes.
const PENDENTES = [{ key: 'status', values: ['Pendente'] }];

export default function PrazosView() {
  const theme = useTheme();
  const list = useEntityList(SOURCE_ID, { defaultFilterTokens: PENDENTES, sortRecords: byDueDateThenPriority });
  const cases = useCollection('cases');
  const statusOptions = useLookup('deadlineStatuses');
  const priorityOptions = useLookup('deadlinePriorities');
  const openRecord = useOpenRecord();

  const caseNumberById = useMemo(() => {
    const map = {};
    for (const item of cases) map[item.id] = item.caseNumber || '';
    return map;
  }, [cases]);

  if (!list.definition) {
    return <div style={{ padding: '24px' }}><InfoBanner message='Tela "Prazos" não encontrada. Instale a extensão para ativá-la.' variant="warning" /></div>;
  }

  const priorityColor = (record) => getConfigColor(priorityOptions, record.priority, theme);

  const renderDaysChip = (record) => {
    if (record.status === 'Concluído') return <DaysChip $tone="success">Concluído</DaysChip>;
    if (record.status === 'Cancelado') return <DaysChip>Cancelado</DaysChip>;
    const days = daysUntilDue(record);
    if (days == null) return null;
    if (isOverdue(record)) {
      return <DaysChip $tone="danger"><Icon name="alert" size={10} />{Math.abs(days)}d vencido</DaysChip>;
    }
    if (days === 0) return <DaysChip $tone="warning">Hoje</DaysChip>;
    if (days === 1) return <DaysChip $tone="warning">Amanhã</DaysChip>;
    return <DaysChip>{days}d</DaysChip>;
  };

  const renderSubtitle = (record) => {
    const number = caseNumberById[record.caseId];
    return (
      <CaseRow>
        {number ? (
          <CaseNumber
            title={'Abrir processo ' + number}
            onClick={(e) => { e.stopPropagation(); openRecord('cases', record.caseId); }}
          >
            {number}
          </CaseNumber>
        ) : null}
        {renderDaysChip(record)}
      </CaseRow>
    );
  };

  const renderBelowHeader = (record) => (
    <Badges>
      <MetaBadge $color={getConfigColor(statusOptions, record.status, theme)}>{record.status}</MetaBadge>
      <MetaBadge $color={priorityColor(record)}>{record.priority}</MetaBadge>
    </Badges>
  );

  return (
    <RecordListSurface
      vm={list}
      definition={list.definition}
      accentColor={priorityColor}
      renderSubtitle={renderSubtitle}
      renderBelowHeader={renderBelowHeader}
      emptyTitle="Nenhum prazo encontrado"
      emptyActionLabel="Cadastrar primeiro prazo"
    />
  );
}
