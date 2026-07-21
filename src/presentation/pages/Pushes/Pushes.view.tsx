import React from 'react';
import { RiInboxLine, RiCheckLine, RiArchiveLine, RiDeleteBinLine, RiBarChartBoxLine, RiErrorWarningLine, RiEyeLine, RiEyeOffLine, RiShieldCheckLine, RiMore2Line, RiTimeLine, RiAlertLine } from 'react-icons/ri';
import { usePushesViewModel } from './Pushes.viewmodel';
import { S } from './Pushes.styles';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { CompositeFilter } from '../../components/ui/CompositeFilter';
import { Dropdown, type DropdownItem } from '../../components/ui/Dropdown';
import { CreateDeadlineFromPushModal } from './CreateDeadlineFromPushModal';
import { usePush } from '../../../stores/usePush';

const STATUS_LABELS: Record<'pending' | 'reviewed' | 'archived' | 'fault', string> = {
  pending: 'Pendente',
  reviewed: 'Revisado',
  archived: 'Arquivado',
  fault: 'Falha',
};

const formatDate = (date: Date): string => {
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const PushesView: React.FC = () => {
  const vm = usePushesViewModel();
  const { loading } = usePush();

  return (
    <S.Page>
      <S.Header>
        <S.TitleRow>
          <RiInboxLine size={22} />
          <S.Title>Pushes do Tribunal</S.Title>
          {vm.unreadCount > 0 && (
            <S.UnreadBadge>{vm.unreadCount}</S.UnreadBadge>
          )}
        </S.TitleRow>
        <S.HeaderActions>
          {vm.hasUnreadInList && (
            <Button onClick={vm.handleMarkAllUnreadAsRead} variant="ghost" size="sm">
              <RiCheckLine size={16} />
              Marcar todos como lidos
            </Button>
          )}
          {vm.hasNotReviewedInList && (
            <Button onClick={vm.handleMarkAllAsReviewed} variant="ghost" size="sm">
              <RiCheckLine size={16} />
              Marcar todos como revisados
            </Button>
          )}
          <Button onClick={vm.handleOpenDashboard} variant="secondary">
            <RiBarChartBoxLine size={18} />
            Dashboard
          </Button>
        </S.HeaderActions>
      </S.Header>

      <S.FilterBar>
        <CompositeFilter
          defs={vm.filterDefs}
          tokens={vm.filterTokens}
          onChange={vm.setFilterTokens}
          placeholder="Filtrar pushes..."
          screenKey={vm.savedFiltersScreenKey}
        />
      </S.FilterBar>

      {loading ? (
        <S.LoadingWrapper><Spinner size={32} /></S.LoadingWrapper>
      ) : vm.rows.length === 0 ? (
        <S.Empty>Nenhum push encontrado.</S.Empty>
      ) : (
        <S.List>
          {vm.rows.map((row) => (
            <S.Card key={row.push.id} $unread={!row.isRead}>
              <S.CardHeader>
                <S.CardTitle>
                  <S.Subject>{row.push.subject}</S.Subject>
                  <S.From>De: {row.push.from}</S.From>
                  <S.From>Para: {row.push.to}</S.From>
                </S.CardTitle>
                <S.Meta>
                  <S.StatusBadge $status={row.push.status}>
                    {row.push.status === 'fault' && <RiErrorWarningLine size={14} />} {STATUS_LABELS[row.push.status]}
                  </S.StatusBadge>
                  {!row.isRead && <S.UnreadBadge>Não lido</S.UnreadBadge>}
                  <S.ExtractionTag>{row.push.parsedByAI ? 'IA' : 'Regex'}</S.ExtractionTag>
                  <span>{formatDate(row.push.receivedAt)}</span>
                </S.Meta>
              </S.CardHeader>

              {row.hasProcessData && (
                <S.ProcessInfo>
                  {row.push.processNumber && (
                    <S.InfoItem>
                      <S.InfoLabel>Processo</S.InfoLabel>
                      <div>
                        {row.caseId ? (
                          <S.ProcessNumberLink
                            onClick={(e) => {
                              e.stopPropagation();
                              vm.handleOpenCase(row.caseId!);
                            }}
                            title={`Abrir processo ${row.push.processNumber}`}
                          >
                            {row.push.processNumber}
                          </S.ProcessNumberLink>
                        ) : (
                          <>
                            <S.InfoValue>{row.push.processNumber}</S.InfoValue>
                            <S.ProcessNotFoundBadge>
                              <RiAlertLine size={10} />
                              Processo não cadastrado
                            </S.ProcessNotFoundBadge>
                          </>
                        )}
                      </div>
                    </S.InfoItem>
                  )}
                  {row.displayCourt && (
                    <S.InfoItem>
                      <S.InfoLabel>Tribunal</S.InfoLabel>
                      <S.InfoValue>{row.displayCourt}</S.InfoValue>
                    </S.InfoItem>
                  )}
                  {row.displayActiveParty && (
                    <S.InfoItem>
                      <S.InfoLabel>Polo Ativo</S.InfoLabel>
                      <S.InfoValue>{row.displayActiveParty}</S.InfoValue>
                    </S.InfoItem>
                  )}
                  {row.displayPassiveParty && (
                    <S.InfoItem>
                      <S.InfoLabel>Polo Passivo</S.InfoLabel>
                      <S.InfoValue>{row.displayPassiveParty}</S.InfoValue>
                    </S.InfoItem>
                  )}
                  {row.displayLegalClass && (
                    <S.InfoItem>
                      <S.InfoLabel>Título</S.InfoLabel>
                      <S.InfoValue>{row.displayLegalClass}</S.InfoValue>
                    </S.InfoItem>
                  )}
                  {row.displayFilingDate && (
                    <S.InfoItem>
                      <S.InfoLabel>Data de Autuação</S.InfoLabel>
                      <S.InfoValue>{row.displayFilingDate.toLocaleDateString()}</S.InfoValue>
                    </S.InfoItem>
                  )}
                  {row.displayCauseValue && (
                    <S.InfoItem>
                      <S.InfoLabel>Valor da Causa</S.InfoLabel>
                      <S.InfoValue>{row.displayCauseValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</S.InfoValue>
                    </S.InfoItem>
                  )}
                </S.ProcessInfo>
              )}

              {row.caseId && (row.casePhase || row.caseStatus) && (
                <S.CaseInfoSection>
                  {row.casePhase && (
                    <S.CaseInfoBadge $color={vm.getPhaseColor(row.casePhase)}>
                      {row.casePhase}
                    </S.CaseInfoBadge>
                  )}
                  {row.caseStatus && (
                    <S.CaseInfoBadge $color={vm.getStatusColor(row.caseStatus)}>
                      {row.caseStatus}
                    </S.CaseInfoBadge>
                  )}
                </S.CaseInfoSection>
              )}

              {row.push.parsingError && (
                <S.InfoItem>
                  <S.InfoLabel>Erro de Processamento</S.InfoLabel>
                  <S.InfoValue style={{ color: 'var(--danger)' }}>{row.push.parsingError}</S.InfoValue>
                </S.InfoItem>
              )}

              {row.linkedDeadlineIds.length > 0 && (
                <S.LinkedDeadlinesSection>
                  {row.mostRecentDeadlineId && (
                    <S.LinkedDeadlineLink onClick={() => vm.handleOpenDeadline(row.mostRecentDeadlineId!)}>
                      <RiTimeLine size={14} />
                      {row.linkedDeadlineIds.length === 1 ? 'Prazo criado' : `${row.linkedDeadlineIds.length} prazos criados`}
                    </S.LinkedDeadlineLink>
                  )}
                </S.LinkedDeadlinesSection>
              )}

              <S.EmailBodyToggle>
                <S.EmailBodyToggleLeft>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => vm.handleToggleBody(row.push.id)}
                  >
                    {row.isBodyVisible ? <RiEyeOffLine size={14} /> : <RiEyeLine size={14} />}
                    {row.isBodyVisible ? 'Ocultar email' : 'Ver email completo'}
                  </Button>
                  {row.isTrustedSource && (
                    <S.TrustedBadge>
                      <RiShieldCheckLine size={12} />
                    </S.TrustedBadge>
                  )}
                </S.EmailBodyToggleLeft>
                <Dropdown
                  align="right"
                  trigger={
                    <S.ActionsButton>
                      <RiMore2Line size={16} />
                      <span>Ações</span>
                    </S.ActionsButton>
                  }
                  items={(() => {
                    const items: DropdownItem[] = [];

                    items.push({
                      id: 'create-deadline',
                      label: 'Gerar prazo',
                      icon: <RiTimeLine size={14} />,
                      onClick: () => vm.handleOpenCreateDeadlineModal(row.push),
                    });

                    if (!row.isRead) {
                      items.push({
                        id: 'mark-read',
                        label: 'Lido',
                        icon: <RiCheckLine size={14} />,
                        onClick: () => vm.handleMarkAsRead(row.push),
                      });
                    }

                    if (row.push.status === 'pending') {
                      items.push({
                        id: 'review',
                        label: 'Revisado',
                        icon: <RiCheckLine size={14} />,
                        onClick: () => vm.handleUpdateStatus(row.push, 'reviewed'),
                      });
                    }

                    if (row.push.status !== 'archived') {
                      items.push({
                        id: 'archive',
                        label: 'Arquivar',
                        icon: <RiArchiveLine size={14} />,
                        onClick: () => vm.handleUpdateStatus(row.push, 'archived'),
                      });
                    }

                    items.push({
                      id: 'delete',
                      label: 'Excluir',
                      icon: <RiDeleteBinLine size={14} />,
                      onClick: () => vm.handleDelete(row.push),
                      variant: 'danger',
                    });

                    return items;
                  })()}
                />
              </S.EmailBodyToggle>

              {row.isBodyVisible && (
                <S.EmailBodyContainer>
                  {row.isTrustedSource && row.sanitizedHtml ? (
                    <S.EmailBodyHtml
                      dangerouslySetInnerHTML={{ __html: (row.sanitizedHtml ?? '').trim().length > 0 ? row.sanitizedHtml : '<p>Sem conteúdo disponível</p>' }}
                    />
                  ) : (
                    <S.EmailBodyText>{(row.plainText ?? '')?.trim().length === 0 ? 'Sem conteúdo disponível' : row.plainText}</S.EmailBodyText>
                  )}
                </S.EmailBodyContainer>
              )}
            </S.Card>
          ))}
        </S.List>
      )}

      {vm.createDeadlineModalPush && (
        <CreateDeadlineFromPushModal
          push={vm.createDeadlineModalPush}
          onClose={vm.handleCloseCreateDeadlineModal}
        />
      )}
    </S.Page>
  );
};
