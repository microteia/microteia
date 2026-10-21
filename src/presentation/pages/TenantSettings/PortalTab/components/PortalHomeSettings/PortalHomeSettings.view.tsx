import React from 'react';
import { RiArrowDownLine, RiArrowUpLine } from 'react-icons/ri';
import { usePortalHomeSettingsViewModel, type PortalHomeListItem } from './PortalHomeSettings.viewmodel';
import { S } from './PortalHomeSettings.styles';
import { Button } from '../../../../../components/ui/Button';
import { Checkbox } from '../../../../../components/ui/Checkbox';
import { Label, Textarea } from '../../../../../components/ui/Input';
import { InfoBanner } from '../../../../../components/ui/InfoBanner';
import { Spinner } from '../../../../../components/ui/Spinner';
import { RadioGroup } from '../../../../../components/ui/RadioButton';
import { getScreenIcon } from '../../../../../shared/screenIcons';
import { useT } from '../../../../../shared/i18n/useT';

/** A home do portal: boas-vindas, a ordem do menu e a dos cartões das extensões. */
export const PortalHomeSettings: React.FC = () => {
  const vm = usePortalHomeSettingsViewModel();
  const t = useT('core.tenant');

  const list = (name: 'menu' | 'widgets', items: PortalHomeListItem[]) => (
    <S.List>
      {items.map((item, index) => (
        <S.Row key={item.id} $muted={!item.visible}>
          {getScreenIcon(item.icon, 18)}
          <S.RowText>
            <S.RowTitle>{item.title}</S.RowTitle>
            <S.RowOrigin>{item.origin}</S.RowOrigin>
          </S.RowText>
          <Checkbox checked={item.visible} onChange={() => vm.toggle(name, item.id)} label={t('portal.settings.visible')} />
          <Button variant="ghost" size="sm" onClick={() => vm.move(name, index, -1)} disabled={index === 0} title={t('portal.settings.move-up')}>
            <RiArrowUpLine size={14} />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => vm.move(name, index, 1)} disabled={index === items.length - 1} title={t('portal.settings.move-down')}>
            <RiArrowDownLine size={14} />
          </Button>
        </S.Row>
      ))}
    </S.List>
  );

  return (
    <S.Section>
      <S.Title>{t('portal.settings.home')}</S.Title>
      <InfoBanner variant="info" message={t('portal.settings.home.description')} />
      {vm.loading ? (
        <Spinner />
      ) : (
        <>
          <Label>{t('portal.settings.layout')}</Label>
          <RadioGroup name="portal-layout" value={vm.layout} onChange={vm.setLayout} options={vm.layouts} />
          <S.Hint>{t('portal.settings.layout.hint')}</S.Hint>

          <Label htmlFor="portal-welcome">{t('portal.settings.welcome')}</Label>
          <Textarea
            id="portal-welcome"
            value={vm.welcome}
            onChange={(event) => vm.setWelcome(event.target.value)}
            placeholder={t('portal.settings.welcome.placeholder')}
          />

          <Label>{t('portal.settings.menu')}</Label>
          {vm.menu.length === 0 ? <S.Hint>{t('portal.settings.menu.empty')}</S.Hint> : list('menu', vm.menu)}

          <Label>{t('portal.settings.widgets')}</Label>
          {vm.widgets.length === 0 ? <S.Hint>{t('portal.settings.widgets.empty')}</S.Hint> : list('widgets', vm.widgets)}

          <S.Actions>
            <Button onClick={() => void vm.save()} disabled={vm.saving}>{t('portal.settings.save')}</Button>
          </S.Actions>
        </>
      )}
    </S.Section>
  );
};
