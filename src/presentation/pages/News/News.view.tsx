import React from 'react';
import { RiAddLine, RiNewspaperLine } from 'react-icons/ri';
import { useNewsViewModel } from './News.viewmodel';
import { NewsCardView } from './NewsCard.view';
import { S } from './News.styles';
import { Button } from '../../components/ui/Button';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { Spinner } from '../../components/ui/Spinner';
import { CompositeFilter } from '../../components/ui/CompositeFilter';
import { useNews } from '../../../stores/useNews';

export const NewsView: React.FC = () => {
  const vm = useNewsViewModel();
  const { loading } = useNews();

  return (
    <S.Page>
      <S.Header>
        <S.TitleRow>
          <RiNewspaperLine size={22} />
          <S.Title>Notícias</S.Title>
          {vm.unreadCount > 0 && (
            <S.UnreadBadge>{vm.unreadCount}</S.UnreadBadge>
          )}
        </S.TitleRow>
        <S.HeaderActions>
          {vm.canCreate && (
            <Button onClick={vm.openCreate} title="Nova Notícia">
              <RiAddLine size={16} />
            </Button>
          )}
        </S.HeaderActions>
      </S.Header>

      <S.FilterBar>
        <CompositeFilter
          defs={vm.filterDefs}
          tokens={vm.filterTokens}
          onChange={vm.setFilterTokens}
          placeholder="Filtrar notícias..."
          screenKey={vm.savedFiltersScreenKey}
        />
      </S.FilterBar>

      {loading ? (
        <S.LoadingWrapper><Spinner size={32} /></S.LoadingWrapper>
      ) : vm.rows.length === 0 ? (
        <S.Empty>Nenhuma notícia encontrada.</S.Empty>
      ) : (
        <S.List>
          {vm.rows.map((row) => (
            <NewsCardView
              key={row.news.id}
              row={row}
              onView={() => vm.openView(row.news.id)}
              onEdit={() => vm.openEdit(row.news)}
              onDelete={() => vm.askDelete(row.news.id)}
              onToggleLike={() => vm.handleToggleLike(row.news)}
              onToggleSaved={() => vm.handleToggleSaved(row.news)}
              onMarkAsUnread={() => vm.handleMarkAsUnread(row.news)}
            />
          ))}
        </S.List>
      )}

      <ConfirmModal
        isOpen={vm.confirm.open}
        title={vm.confirm.title}
        message={vm.confirm.message}
        variant="danger"
        onConfirm={vm.runConfirm}
        onCancel={vm.cancelConfirm}
      />
    </S.Page>
  );
};
