import React from 'react';
import { RiInboxLine, RiCheckLine, RiArchiveLine, RiDeleteBinLine, RiEyeLine, RiBarChartBoxLine } from 'react-icons/ri';
import { usePushesViewModel } from './Pushes.viewmodel';
import { S } from './Pushes.styles';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { CompositeFilter } from '../../components/ui/CompositeFilter';
import { usePush } from '../../../stores/usePush';
import { formatDistanceToNow } from '../../../utils/formatters';

const STATUS_LABELS: Record<'pending' | 'reviewed' | 'archived', string> = {
  pending: 'Pendente',
  reviewed: 'Revisado',
  archived: 'Arquivado',
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
        <Button onClick={vm.handleOpenDashboard} variant="secondary">
          <RiBarChartBoxLine size={18} />
          Dashboard
        </Button>
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
                </S.CardTitle>
                <S.Meta>
                  <S.StatusBadge $status={row.push.status}>
                    {STATUS_LABELS[row.push.status]}
                  </S.StatusBadge>
                  {!row.isRead && <S.UnreadBadge>Não lido</S.UnreadBadge>}
                  <span>{formatDistanceToNow(row.push.receivedAt)}</span>
                </S.Meta>
              </S.CardHeader>

              {row.hasProcessData && (
                <S.ProcessInfo>
                  {row.push.processNumber && (
                    <S.InfoItem>
                      <S.InfoLabel>Processo</S.InfoLabel>
                      <S.InfoValue>{row.push.processNumber}</S.InfoValue>
                    </S.InfoItem>
                  )}
                  {row.push.court && (
                    <S.InfoItem>
                      <S.InfoLabel>Tribunal</S.InfoLabel>
                      <S.InfoValue>{row.courtLabel}</S.InfoValue>
                    </S.InfoItem>
                  )}
                  {row.push.activeParty && (
                    <S.InfoItem>
                      <S.InfoLabel>Polo Ativo</S.InfoLabel>
                      <S.InfoValue>{row.push.activeParty}</S.InfoValue>
                    </S.InfoItem>
                  )}
                  {row.push.passiveParty && (
                    <S.InfoItem>
                      <S.InfoLabel>Polo Passivo</S.InfoLabel>
                      <S.InfoValue>{row.push.passiveParty}</S.InfoValue>
                    </S.InfoItem>
                  )}
                  {row.push.legalClass && (
                    <S.InfoItem>
                      <S.InfoLabel>Classe</S.InfoLabel>
                      <S.InfoValue>{row.push.legalClass}</S.InfoValue>
                    </S.InfoItem>
                  )}
                  {row.push.filingDate && (
                    <S.InfoItem>
                      <S.InfoLabel>Data de Autuação</S.InfoLabel>
                      <S.InfoValue>{new Date(row.push.filingDate).toLocaleDateString()}</S.InfoValue>
                    </S.InfoItem>
                  )}
                </S.ProcessInfo>
              )}

              {row.push.parsingError && (
                <S.InfoItem>
                  <S.InfoLabel>Erro de Processamento</S.InfoLabel>
                  <S.InfoValue style={{ color: 'var(--danger)' }}>{row.push.parsingError}</S.InfoValue>
                </S.InfoItem>
              )}

              <S.Actions>
                <Button
                  size="small"
                  variant="secondary"
                  onClick={() => vm.handleViewPush(row.push)}
                >
                  <RiEyeLine size={14} />
                  Visualizar
                </Button>

                {!row.isRead && (
                  <Button
                    size="small"
                    variant="ghost"
                    onClick={() => vm.handleMarkAsRead(row.push)}
                  >
                    <RiCheckLine size={14} />
                    Marcar como lido
                  </Button>
                )}

                {row.push.status === 'pending' && (
                  <Button
                    size="small"
                    variant="ghost"
                    onClick={() => vm.handleUpdateStatus(row.push, 'reviewed')}
                  >
                    <RiCheckLine size={14} />
                    Revisar
                  </Button>
                )}

                {row.push.status !== 'archived' && (
                  <Button
                    size="small"
                    variant="ghost"
                    onClick={() => vm.handleUpdateStatus(row.push, 'archived')}
                  >
                    <RiArchiveLine size={14} />
                    Arquivar
                  </Button>
                )}

                <Button
                  size="small"
                  variant="ghost"
                  onClick={() => vm.handleDelete(row.push)}
                >
                  <RiDeleteBinLine size={14} />
                  Excluir
                </Button>
              </S.Actions>
            </S.Card>
          ))}
        </S.List>
      )}
    </S.Page>
  );
};
