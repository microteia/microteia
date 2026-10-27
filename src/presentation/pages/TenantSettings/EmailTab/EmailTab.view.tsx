import React from 'react';
import { S } from './EmailTab.styles';
import { useEmailTabViewModel } from './EmailTab.viewmodel';
import { SideTabs } from '../../../components/ui/SideTabs';
import { EmailServer } from './components/EmailServer';
import { SmsServer } from './components/SmsServer';
import { EmailAppearance } from './components/EmailAppearance';
import { NotificationTemplates } from './components/NotificationTemplates';

/** Os avisos do escritório: o servidor que envia, a cara do e-mail e o texto de cada tipo. */
export const EmailTabView: React.FC = () => {
  const vm = useEmailTabViewModel();

  return (
    <S.Container>
      <SideTabs items={vm.sections} active={vm.section} onChange={vm.setSection}>
        <S.Intro>
          <S.Title>{vm.title}</S.Title>
          <S.Description>{vm.description}</S.Description>
        </S.Intro>
        {vm.section === 'server' && <EmailServer />}
        {vm.section === 'sms' && <SmsServer />}
        {vm.section === 'appearance' && <EmailAppearance />}
        {vm.section === 'templates' && <NotificationTemplates />}
      </SideTabs>
    </S.Container>
  );
};
