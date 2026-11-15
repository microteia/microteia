import React from 'react';
import { CopyButton } from '../../../components/ui/CopyButton';
import { useT } from '../../../shared/i18n/useT';
import type { ForwardingRule } from '../../../../domain/schema/mailbox';
import { useForwardingGuideViewModel } from './ForwardingGuide.viewmodel';
import { S } from './ForwardingGuide.styles';

interface ForwardingGuideProps {
  address: string;
  rule: ForwardingRule | null;
}

const Snippet: React.FC<{ text: string }> = ({ text }) => (
  <S.Snippet>
    <S.Code>{text}</S.Code>
    <CopyButton text={text} size={14} inline />
  </S.Snippet>
);

export const ForwardingGuide: React.FC<ForwardingGuideProps> = ({ address, rule }) => {
  const t = useT('core.automation');
  const vm = useForwardingGuideViewModel(rule);

  return (
    <S.Container>
      <S.Tabs role="tablist">
        {vm.tabs.map((tab) => (
          <S.Tab
            key={tab.provider}
            type="button"
            role="tab"
            aria-selected={vm.provider === tab.provider}
            $active={vm.provider === tab.provider}
            onClick={() => vm.setProvider(tab.provider)}
          >
            {tab.label}
          </S.Tab>
        ))}
      </S.Tabs>

      {vm.provider === 'gmail' && (
        <S.Steps>
          <S.Step>
            {t('mailbox.guide.gmail.step1')}
            <Snippet text={address} />
          </S.Step>
          <S.Step>{t('mailbox.guide.gmail.step2')}</S.Step>
          <S.Step>
            {t(vm.gmailQuery ? 'mailbox.guide.gmail.step3.filtered' : 'mailbox.guide.gmail.step3.any')}
            {vm.gmailQuery && <Snippet text={vm.gmailQuery} />}
          </S.Step>
        </S.Steps>
      )}

      {vm.provider === 'outlook' && (
        <S.Steps>
          <S.Step>{t('mailbox.guide.outlook.step1')}</S.Step>
          <S.Step>
            {vm.acceptsAnything && t('mailbox.guide.outlook.step2.any')}
            {vm.senders && t('mailbox.guide.outlook.step2.senders')}
            {vm.senders && <Snippet text={vm.senders} />}
            {vm.subjects && t('mailbox.guide.outlook.step2.subjects')}
            {vm.subjects && <Snippet text={vm.subjects} />}
          </S.Step>
          <S.Step>
            {t('mailbox.guide.outlook.step3')}
            <Snippet text={address} />
          </S.Step>
        </S.Steps>
      )}

      {vm.provider === 'other' && (
        <S.Steps>
          <S.Step>
            {t('mailbox.guide.other.step1')}
            <Snippet text={address} />
          </S.Step>
          <S.Step>
            {vm.acceptsAnything && t('mailbox.guide.other.any')}
            {vm.senders && t('mailbox.guide.other.senders')}
            {vm.senders && <Snippet text={vm.senders} />}
            {vm.subjects && t('mailbox.guide.other.subjects')}
            {vm.subjects && <Snippet text={vm.subjects} />}
          </S.Step>
          <S.Step>{t('mailbox.guide.other.step2')}</S.Step>
        </S.Steps>
      )}

      <S.Note>{t('mailbox.guide.original-sender')}</S.Note>
      {vm.provider === 'gmail' && <S.Note>{t('mailbox.guide.gmail.note')}</S.Note>}
      {vm.provider === 'outlook' && <S.Note>{t('mailbox.guide.outlook.note')}</S.Note>}
    </S.Container>
  );
};
