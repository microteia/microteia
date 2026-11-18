import React from 'react';
import { RiDeleteBinLine } from 'react-icons/ri';
import { S } from './ScreenListOrderPanel.styles';
import { useScreenListOrderPanelViewModel } from './ScreenListOrderPanel.viewmodel';
import type { ScreenListOrderPanelProps } from './ScreenListOrderPanel.viewmodel';
import { Button } from '../../../../components/ui/Button';
import { InfoBanner } from '../../../../components/ui/InfoBanner';
import { SearchSelect } from '../../../../components/ui/SearchSelect';
import { useT } from '../../../../shared/i18n/useT';

/** A seção "Ordem dos registros" da aba Cartão: as chaves que ordenam a lista e a aba no pai. */
export const ScreenListOrderPanel: React.FC<ScreenListOrderPanelProps> = (props) => {
  const vm = useScreenListOrderPanelViewModel(props);
  const t = useT('core.records');
  return (
    <S.Section>
      <S.SectionTitle>{t('list-order.panel.title')}</S.SectionTitle>
      <S.Hint>{t('list-order.panel.description')}</S.Hint>
      {vm.fromExtension && <InfoBanner variant="warning" message={t('list-order.panel.from-extension')} />}
      {vm.rows.map((row, index) => (
        <S.KeyRow key={row.id}>
          <SearchSelect
            options={vm.pathOptions}
            value={row.path}
            onChange={(value) => vm.setPath(index, value)}
            placeholder={t('list-order.panel.field')}
          />
          <SearchSelect
            options={vm.directionOptions}
            value={row.dir}
            onChange={(value) => vm.setDir(index, value)}
          />
          <S.RemoveButton type="button" title={t('list-order.panel.remove')} onClick={() => vm.remove(index)}>
            <RiDeleteBinLine />
          </S.RemoveButton>
        </S.KeyRow>
      ))}
      {vm.canAdd && (
        <S.Actions>
          <Button type="button" variant="secondary" size="sm" onClick={vm.add}>{t('list-order.panel.add')}</Button>
        </S.Actions>
      )}
      <S.Hint>{vm.hasKeys ? vm.windowHint : t('list-order.panel.default')}</S.Hint>
      {vm.issues.map((issue) => <InfoBanner key={issue} variant="warning" message={issue} />)}
    </S.Section>
  );
};
