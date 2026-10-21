import React from 'react';
import { RiSave3Line } from 'react-icons/ri';
import { S } from './EmailAppearance.styles';
import { useEmailAppearanceViewModel } from './EmailAppearance.viewmodel';
import { Button } from '../../../../../components/ui/Button';
import { Checkbox } from '../../../../../components/ui/Checkbox';
import { Textarea, Input } from '../../../../../components/ui/Input';
import { ColorSwatchPicker } from '../../../../../components/ui/ColorSwatchPicker';
import { HtmlView } from '../../../../../components/ui/HtmlView';
import { useT } from '../../../../../shared/i18n/useT';

/** Logo, cor, assinatura e rodapé de todo e-mail do escritório — e como ele vai chegar. */
export const EmailAppearance: React.FC = () => {
  const vm = useEmailAppearanceViewModel();
  const t = useT('core.automation');

  return (
    <S.Layout>
      <S.Form>
        <S.Field>
          <Checkbox
            checked={vm.layout.showLogo && vm.hasLogo}
            onChange={vm.setShowLogo}
            label={t('notifications.appearance.logo')}
            disabled={!vm.hasLogo}
          />
          <S.Hint>{vm.hasLogo ? t('notifications.appearance.logo.hint') : t('notifications.appearance.logo.missing')}</S.Hint>
        </S.Field>

        <S.Field>
          <S.Label>{t('notifications.appearance.accent')}</S.Label>
          <S.ColorRow>
            <S.DefaultChip type="button" $active={!vm.layout.accentColor} onClick={() => vm.setAccent('')}>
              {t('notifications.appearance.accent.default')}
            </S.DefaultChip>
            <ColorSwatchPicker colors={vm.accentOptions} value={vm.layout.accentColor} onChange={vm.setAccent} />
          </S.ColorRow>
        </S.Field>

        <S.Field>
          <S.Label>{t('notifications.appearance.signature')}</S.Label>
          <Textarea rows={3} value={vm.layout.signature} onChange={(event) => vm.setSignature(event.target.value)} />
          <S.Hint>{t('notifications.appearance.markdown-hint')}</S.Hint>
        </S.Field>

        <S.Field>
          <S.Label>{t('notifications.appearance.footer')}</S.Label>
          <Input
            value={vm.layout.footer}
            onChange={(event) => vm.setFooter(event.target.value)}
            placeholder={t('notifications.appearance.footer.placeholder')}
          />
          <S.Hint>{t('notifications.appearance.footer.hint')}</S.Hint>
        </S.Field>

        {vm.dirty && (
          <S.Actions>
            <Button variant="ghost" onClick={vm.discard} disabled={vm.saving}>{t('notifications.appearance.discard')}</Button>
            <Button variant="primary" onClick={vm.save} disabled={vm.saving}>
              <RiSave3Line />
              {t('notifications.appearance.save')}
            </Button>
          </S.Actions>
        )}
      </S.Form>

      <S.Preview>
        <S.Label>{t('notifications.appearance.preview')}</S.Label>
        <HtmlView html={vm.previewHtml} height={460} />
      </S.Preview>
    </S.Layout>
  );
};
