import React from 'react';
import { RiAddLine } from 'react-icons/ri';
import { S } from './PortalChildList.styles';
import { usePortalChildListViewModel, type PortalChildListProps } from './PortalChildList.viewmodel';
import { CompositeFilter } from '../../../../components/ui/CompositeFilter';
import { Button } from '../../../../components/ui/Button';
import { Spinner } from '../../../../components/ui/Spinner';
import { useT } from '../../../../shared/i18n/useT';
import { PortalCardList } from '../PortalCardList';

/** Uma aba do registro aberto: os filhos dele, os mais recentes, e o filtro para achar o resto. */
export const PortalChildList: React.FC<PortalChildListProps> = (props) => {
  const vm = usePortalChildListViewModel(props);
  const t = useT('core.tenant');

  return (
    <S.Container>
      <S.Toolbar>
        <S.FilterSlot>
          <CompositeFilter defs={vm.filterDefs} tokens={vm.tokens} onChange={vm.setTokens} placeholder={t('portal.filter.placeholder')} />
        </S.FilterSlot>
        {vm.createLabel && (
          <Button size="sm" onClick={vm.create} title={vm.createLabel} aria-label={vm.createLabel}>
            <RiAddLine size={16} />
          </Button>
        )}
      </S.Toolbar>

      {vm.failed ? (
        <S.Empty>{t('portal.load-failed')}</S.Empty>
      ) : vm.loading && vm.cards.length === 0 ? (
        <S.Empty><Spinner size={20} /></S.Empty>
      ) : vm.cards.length === 0 ? (
        <S.Empty>{vm.emptyText}</S.Empty>
      ) : vm.arrangement ? (
        <PortalCardList cards={vm.cards} arrangement={vm.arrangement} onOpen={vm.openCard} />
      ) : (
        <S.List>
          {vm.cards.map((card) => (
            <S.Row key={card.id} type="button" onClick={() => vm.open(card.id)}>
              <S.RowTitle>{card.title}</S.RowTitle>
              {card.summary && <S.RowMeta>{card.summary}</S.RowMeta>}
              {card.updatedAt && <S.RowMeta>{card.updatedAt}</S.RowMeta>}
            </S.Row>
          ))}
        </S.List>
      )}
      {vm.windowNote && <S.Note>{vm.windowNote}</S.Note>}
    </S.Container>
  );
};
