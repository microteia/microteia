import React from 'react';
import { RiArrowLeftLine } from 'react-icons/ri';
import { useLicenseViewModel } from './License.viewmodel';
import { InfoBanner } from '../../components/ui/InfoBanner';
import { S } from './License.styles';
import { useT } from '../../shared/i18n/useT';

/**
 * O documento inteiro vem do namespace `core.license`, e não desta tela. A View guarda apenas a
 * ESTRUTURA — quais seções existem, quais são listas —, e quem escreve cada parágrafo é o catálogo.
 * É o que permite traduzir o contrato instalando um pacote, sem tocar em código.
 */
export const LicenseView: React.FC = () => {
  const vm = useLicenseViewModel();
  const t = useT('core.license');
  const tUi = useT('core.ui');

  return (
    <S.Page>
      <S.Card>
        {vm.showBackButton && (
          <S.BackLink onClick={vm.goBack}>
            <RiArrowLeftLine /> {tUi('core.workspace/action.back')}
          </S.BackLink>
        )}

        <S.Logo>
          {/* eslint-disable-next-line no-restricted-syntax -- "Microteia" é a MARCA: não traduz em idioma nenhum. */}
          <img src="/logo.png" alt="Microteia" style={{ width: '64px', height: '64px' }} />
        </S.Logo>

        <S.Title>{t('page.title')}</S.Title>
        <S.UpdatedAt>{t('updated-at', { date: vm.updatedAt })}</S.UpdatedAt>

        <S.BannerGroup>
          <InfoBanner variant="warning" message={t('banner.beta')} />
          <InfoBanner variant="warning" message={t('banner.email-monitor')} />
        </S.BannerGroup>

        <S.Section>
          <S.SectionTitle>{t('acceptance.title')}</S.SectionTitle>
          <S.Paragraph>{t('acceptance.text')}</S.Paragraph>
        </S.Section>

        <S.Section>
          <S.SectionTitle>{t('service.title')}</S.SectionTitle>
          <S.Paragraph>{t('service.text')}</S.Paragraph>
        </S.Section>

        <S.Section>
          <S.SectionTitle>{t('beta.title')}</S.SectionTitle>
          <S.Paragraph>{t('beta.text')}</S.Paragraph>
          <S.List>
            <S.ListItem>{t('beta.item.failures')}</S.ListItem>
            <S.ListItem>{t('beta.item.changes')}</S.ListItem>
            <S.ListItem>{t('beta.item.uptime')}</S.ListItem>
            <S.ListItem>{t('beta.item.parallel')}</S.ListItem>
          </S.List>
        </S.Section>

        <S.Section>
          <S.SectionTitle>{t('account.title')}</S.SectionTitle>
          <S.Paragraph>{t('account.text')}</S.Paragraph>
        </S.Section>

        <S.Section>
          <S.SectionTitle>{t('privacy.title')}</S.SectionTitle>
          <S.Paragraph>{t('privacy.text')}</S.Paragraph>
          <S.List>
            <S.ListItem>{t('privacy.item.account')}</S.ListItem>
            <S.ListItem>{t('privacy.item.records')}</S.ListItem>
            <S.ListItem>{t('privacy.item.email')}</S.ListItem>
            <S.ListItem>{t('privacy.item.audit')}</S.ListItem>
          </S.List>
          <S.Paragraph>{t('privacy.isolation')}</S.Paragraph>
          <S.Paragraph>{t('privacy.rights')}</S.Paragraph>
        </S.Section>

        <S.Section>
          <S.SectionTitle>{t('security.title')}</S.SectionTitle>
          <S.Paragraph>{t('security.text')}</S.Paragraph>
        </S.Section>

        <S.Section>
          <S.SectionTitle>{t('liability.title')}</S.SectionTitle>
          <S.Paragraph>{t('liability.text')}</S.Paragraph>
        </S.Section>

        <S.Section>
          <S.SectionTitle>{t('ip.title')}</S.SectionTitle>
          <S.Paragraph>{t('ip.text')}</S.Paragraph>
        </S.Section>

        <S.Section>
          <S.SectionTitle>{t('changes.title')}</S.SectionTitle>
          <S.Paragraph>{t('changes.text')}</S.Paragraph>
        </S.Section>

        <S.Section>
          <S.SectionTitle>{t('law.title')}</S.SectionTitle>
          <S.Paragraph>{t('law.text')}</S.Paragraph>
        </S.Section>

        <S.Divider />

        <S.Section>
          <S.SectionTitle>{t('contact.title')}</S.SectionTitle>
          <S.Paragraph>{t('contact.text')}</S.Paragraph>
          <S.ContactCard>
            <p><strong>{vm.authorName}</strong></p>
            <p>{t('contact.email-label')} {vm.authorEmail}</p>
          </S.ContactCard>
        </S.Section>
      </S.Card>
    </S.Page>
  );
};
