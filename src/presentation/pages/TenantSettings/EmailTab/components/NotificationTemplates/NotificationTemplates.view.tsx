import React from 'react';
import { RiNotification3Line, RiSave3Line } from 'react-icons/ri';
import { S } from './NotificationTemplates.styles';
import { useNotificationTemplatesViewModel } from './NotificationTemplates.viewmodel';
import { Button } from '../../../../../components/ui/Button';
import { Input, Textarea } from '../../../../../components/ui/Input';
import { SearchSelect } from '../../../../../components/ui/SearchSelect';
import { HtmlView } from '../../../../../components/ui/HtmlView';
import { useT } from '../../../../../shared/i18n/useT';

/** O texto de cada tipo de aviso, canal por canal — um de cada vez, com o resultado ao lado. */
export const NotificationTemplates: React.FC = () => {
  const vm = useNotificationTemplatesViewModel();
  const t = useT('core.automation');

  return (
    <S.Container>
      <S.Pickers>
        <S.TypeSelect>
          <SearchSelect options={vm.types} value={vm.type} onChange={vm.setType} placeholder={t('notifications.templates.type')} />
        </S.TypeSelect>
        <S.Segmented role="tablist">
          {vm.channels.map((channel) => (
            <S.Segment key={channel.key} type="button" role="tab" $active={vm.channel === channel.key} onClick={() => vm.setChannel(channel.key)}>
              {channel.label}
              {channel.customized && <S.CustomDot title={t('notifications.templates.customized')} />}
            </S.Segment>
          ))}
        </S.Segmented>
      </S.Pickers>

      <S.Layout>
        <S.Form>
          <S.Hint>{vm.channelHint}</S.Hint>
          {vm.fields.map((field) => (
            <S.Field key={field.key}>
              <S.Label>{field.label}</S.Label>
              {field.multiline ? (
                <Textarea
                  rows={6}
                  maxLength={field.max}
                  value={field.value}
                  placeholder={t('notifications.templates.placeholder.message')}
                  onFocus={() => vm.focusField(field.key)}
                  onChange={(event) => vm.setField(field.key, event.target.value)}
                />
              ) : (
                <Input
                  maxLength={field.max}
                  value={field.value}
                  placeholder={t('notifications.templates.placeholder.title')}
                  onFocus={() => vm.focusField(field.key)}
                  onChange={(event) => vm.setField(field.key, event.target.value)}
                />
              )}
            </S.Field>
          ))}

          <S.Field>
            <S.Label>{t('notifications.templates.variables')}</S.Label>
            <S.Variables>
              {vm.variables.map((variable) => (
                <S.Variable key={variable} type="button" onClick={() => vm.insertVariable(variable)}>{`{${variable}}`}</S.Variable>
              ))}
            </S.Variables>
            <S.Hint>{vm.channel === 'email' ? t('notifications.appearance.markdown-hint') : t('notifications.templates.empty-hint')}</S.Hint>
          </S.Field>

          <S.Actions>
            {vm.customized && !vm.dirty && (
              <Button variant="ghost" onClick={vm.reset} disabled={vm.saving}>{t('notifications.templates.reset')}</Button>
            )}
            {vm.dirty && (
              <>
                <Button variant="ghost" onClick={vm.discard} disabled={vm.saving}>{t('notifications.appearance.discard')}</Button>
                <Button variant="primary" onClick={vm.save} disabled={vm.saving}>
                  <RiSave3Line />
                  {t('notifications.appearance.save')}
                </Button>
              </>
            )}
          </S.Actions>
        </S.Form>

        <S.Preview>
          <S.Label>{t('notifications.appearance.preview')}</S.Label>
          {vm.preview.kind === 'email' ? (
            <HtmlView html={vm.preview.html} height={460} />
          ) : (
            <S.NoticeCard>
              <S.NoticeIcon><RiNotification3Line size={18} /></S.NoticeIcon>
              <div>
                <S.NoticeTitle>{vm.preview.title}</S.NoticeTitle>
                <S.NoticeBody>{vm.preview.body}</S.NoticeBody>
              </div>
            </S.NoticeCard>
          )}
        </S.Preview>
      </S.Layout>
    </S.Container>
  );
};
