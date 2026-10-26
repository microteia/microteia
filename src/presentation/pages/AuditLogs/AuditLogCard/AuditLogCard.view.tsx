import React from 'react';
import { useTheme } from 'styled-components';
import { RiArrowRightSLine, RiInformationFill, RiAlertFill, RiErrorWarningFill } from 'react-icons/ri';
import { UserAvatar } from '../../../components/ui/UserAvatar';
import { MarkdownContent } from '../../../components/ui/MarkdownContent';
import { S, severityColor, actionColor } from './AuditLogCard.styles';
import type { AuditLogRow } from '../AuditLogs.viewmodel';
import { ACTION_KEYS } from '../auditLogLabels';
import type { AuditSeverity } from '../../../../domain/entities';

import { useT } from '../../../shared/i18n/useT';
function formatLogTime(d: Date): string {
  const pad = (n: number, len = 2) => String(n).padStart(len, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} `
    + `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
}

const SeverityIcon: React.FC<{ severity: AuditSeverity; color: string }> = ({ severity, color }) => {
  if (severity === 'CRITICAL') return <RiErrorWarningFill size={15} color={color} />;
  if (severity === 'HIGH') return <RiAlertFill size={15} color={color} />;
  return <RiInformationFill size={15} color={color} />;
};

interface AuditLogCardProps {
  row: AuditLogRow;
  onToggleExpand: () => void;
  onOpenEntity: (log: AuditLogRow['log']) => void;
}

export const AuditLogCardView: React.FC<AuditLogCardProps> = ({ row, onToggleExpand, onOpenEntity }) => {
  const t = useT('core.admin');
  const { log, expanded, tenantName, entityLabel } = row;
  // Há para onde ir quando o log guarda a coleção do registro (o caminho novo) ou a chave de aba
  // fixa (os logs anteriores).
  const canOpenRecord = !!log.linkCollection || !!log.entityLink;
  const theme = useTheme();

  return (
    <S.Row>
      <S.RowHeader onClick={onToggleExpand} aria-expanded={expanded}>
        <S.Chevron $expanded={expanded}><RiArrowRightSLine size={16} /></S.Chevron>
        <S.SeverityIcon $severity={log.severity} title={t('audit.severity.title', { severity: log.severity })}>
          <SeverityIcon severity={log.severity} color={severityColor(theme, log.severity)} />
        </S.SeverityIcon>
        <S.Time>{formatLogTime(log.createdAt)}</S.Time>
        <S.Summary>
          <S.ActionChip $color={actionColor(theme, log.action)}>{t(ACTION_KEYS[log.action])}</S.ActionChip>
          <S.Chip>{entityLabel}</S.Chip>
          {tenantName && <S.Chip>{tenantName}</S.Chip>}
          <S.SummaryText>{log.title}</S.SummaryText>
        </S.Summary>
      </S.RowHeader>

      {expanded && (
        <S.Details>
          <S.DetailsMeta>
            <UserAvatar src={log.photoURL || null} name={log.userName || t('audit.entity.system')} size={20} />
            <S.UserName>{t('audit.by', { name: log.userName || t('audit.entity.system') })}</S.UserName>
          </S.DetailsMeta>

          <S.Body>
            <MarkdownContent>{log.text}</MarkdownContent>
          </S.Body>

          {row.hash && <S.Hash>{t('audit.archive.line-hash', { hash: row.hash })}</S.Hash>}

          {canOpenRecord && !(log.action === 'DELETE') && (
            <S.LinkButton onClick={() => onOpenEntity(log)}>
              {t('audit.open-record')}
            </S.LinkButton>
          )}
        </S.Details>
      )}
    </S.Row>
  );
};
