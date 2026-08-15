import React from 'react';
import { S } from './Translations.styles';
import { useTranslationsViewModel } from './Translations.viewmodel';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { InfoBanner } from '../../components/ui/InfoBanner';
import { getScreenIcon } from '../../shared/screenIcons';

import { useT } from '../../shared/i18n/useT';
export const TranslationsView: React.FC = () => {
  const t = useT('core.i18n');
  const vm = useTranslationsViewModel();

  return (
    <S.Page>
      <S.Header>
        <S.Title>{t('page.translations')}</S.Title>
        <S.Subtitle>{t('translations.subtitle')}</S.Subtitle>
      </S.Header>

      {!vm.canManage && (
        <InfoBanner
          message={t('translations.admin-only')}
          variant="info"
        />
      )}

      <S.Section>
        <S.SectionTitle>{t('translations.step.download')}</S.SectionTitle>
        <S.Hint>{t('translations.download.hint')}</S.Hint>

        <S.Row>
          <S.Field>
            <S.Label htmlFor="target-locale">{t('translations.locale')}</S.Label>
            <Input
              id="target-locale"
              value={vm.targetLocale}
              placeholder={t('translations.locale.placeholder')}
              onChange={(event) => vm.setTargetLocale(event.target.value)}
            />
          </S.Field>

          <Button onClick={vm.download} disabled={!vm.isTargetValid}>
            {t('translations.download')}
          </Button>

          {vm.isTargetValid && (
            <S.Progress>
              {getScreenIcon('globe', 16)}
              {t('translations.summary', { name: vm.targetLocaleName, count: vm.keyCount })}
            </S.Progress>
          )}
        </S.Row>
      </S.Section>

      <S.Section>
        <S.SectionTitle>{t('translations.step.import')}</S.SectionTitle>
        <S.Hint>{t('translations.import.hint')}</S.Hint>

        <S.Row>
          <Button onClick={vm.pickFile} disabled={!vm.canManage || vm.busy}>
            {t(vm.busy ? 'translations.installing' : 'translations.import')}
          </Button>
        </S.Row>
      </S.Section>

      <S.Section>
        <S.SectionTitle>{t('translations.installed')}</S.SectionTitle>
        <S.Hint>{t('translations.installed.hint')}</S.Hint>

        {vm.languages.length === 0 ? (
          <S.Empty>{t('translations.none-installed')}</S.Empty>
        ) : (
          <S.InstalledList>
            {vm.languages.map((language) => (
              <S.InstalledItem key={language.id}>
                <S.ItemName>
                  {getScreenIcon('globe', 16)}
                  {language.name}
                  {language.inUse && <Badge>{t('translations.badge.in-use')}</Badge>}
                  {language.shadowed && <Badge>{t('translations.badge.shadowed')}</Badge>}
                  {!language.active && <Badge>{t('translations.badge.disabled')}</Badge>}
                </S.ItemName>
                <S.ItemMeta>
                  {t('translations.summary', { name: language.locale, count: language.keyCount })}
                </S.ItemMeta>
              </S.InstalledItem>
            ))}
          </S.InstalledList>
        )}

        {vm.languages.some((language) => language.shadowed) && (
          <InfoBanner
            message={t('translations.shadowed.notice')}
            variant="warning"
          />
        )}
      </S.Section>
    </S.Page>
  );
};
