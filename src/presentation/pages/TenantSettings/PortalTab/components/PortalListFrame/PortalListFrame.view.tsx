import React from 'react';
import { RiArrowLeftSLine, RiArrowRightSLine, RiSearchLine } from 'react-icons/ri';
import { S } from './PortalListFrame.styles';
import { Button } from '../../../../../components/ui/Button';
import { Input } from '../../../../../components/ui/Input';
import { Spinner } from '../../../../../components/ui/Spinner';
import { useT } from '../../../../../shared/i18n/useT';
import type { PortalPagedList } from '../../usePortalPagedList';

interface PortalListFrameProps {
  title: string;
  list: Pick<PortalPagedList<unknown>,
    'loading' | 'search' | 'setSearch' | 'term' | 'page' | 'hasPrevious' | 'hasNext' | 'previous' | 'next'
  > & { count: number };
  /** O que dizer quando não há ninguém, sem busca nenhuma. */
  emptyMessage: string;
  children: React.ReactNode;
}

/** Uma lista da aba Portal na própria moldura: busca pelo e-mail, rolagem interna e paginação. */
export const PortalListFrame: React.FC<PortalListFrameProps> = ({ title, list, emptyMessage, children }) => {
  const t = useT('core.tenant');

  return (
    <S.Frame>
      <S.Header>
        <S.Title>{title}</S.Title>
        <S.Search>
          <RiSearchLine size={14} />
          <Input
            type="search"
            value={list.search}
            onChange={(event) => list.setSearch(event.target.value)}
            placeholder={t('portal.list.search')}
            aria-label={t('portal.list.search')}
          />
        </S.Search>
      </S.Header>
      <S.Body>
        {list.loading ? (
          <S.SpinnerWrap><Spinner /></S.SpinnerWrap>
        ) : list.count === 0 ? (
          <S.Message>{list.term ? t('portal.list.no-match', { search: list.term }) : emptyMessage}</S.Message>
        ) : (
          children
        )}
      </S.Body>
      {(list.hasPrevious || list.hasNext) && (
        <S.Footer>
          {t('portal.list.page', { page: list.page })}
          <Button variant="ghost" size="sm" onClick={list.previous} disabled={!list.hasPrevious} title={t('portal.list.previous')}>
            <RiArrowLeftSLine size={16} />
          </Button>
          <Button variant="ghost" size="sm" onClick={list.next} disabled={!list.hasNext} title={t('portal.list.next')}>
            <RiArrowRightSLine size={16} />
          </Button>
        </S.Footer>
      )}
    </S.Frame>
  );
};
