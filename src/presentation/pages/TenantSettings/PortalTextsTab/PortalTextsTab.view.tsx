import React from 'react';
import { RiEditLine } from 'react-icons/ri';
import { usePortalTextsTabViewModel } from './PortalTextsTab.viewmodel';
import { S } from './PortalTextsTab.styles';
import { Button } from '../../../components/ui/Button';
import { Label } from '../../../components/ui/Input';
import { SearchSelect } from '../../../components/ui/SearchSelect';
import { ConfirmModal } from '../../../components/ui/ConfirmModal';
import { Spinner } from '../../../components/ui/Spinner';
import { InfoBanner } from '../../../components/ui/InfoBanner';
import { PortalTemplateNodes } from '../../Portal/components/PortalTemplateNodes';
import { useT } from '../../../shared/i18n/useT';

export const PortalTextsTabView: React.FC = () => {
  const t = useT('core.tenant');
  const ui = useT('core.ui');
  const vm = usePortalTextsTabViewModel();

  if (vm.loading) return <Spinner />;

  return (
    <S.Container>
      <InfoBanner variant="info" message={t('portal.texts.description')} />

      {vm.items.length === 0 ? (
        <S.Empty>{t('portal.texts.none')}</S.Empty>
      ) : (
        <S.List>
          {vm.items.map((item) => (
            <S.Row key={item.ref} $active={vm.editor?.ref === item.ref}>
              <S.RowText>
                <S.RowTitle>{item.title}</S.RowTitle>
                <S.RowMeta>
                  {item.edited ? t('portal.texts.status.edited', { languages: item.edited }) : t('portal.texts.status.package')}
                </S.RowMeta>
                <S.RowMeta>{item.ref}</S.RowMeta>
              </S.RowText>
              <Button variant="ghost" size="sm" onClick={() => vm.open(item.ref)} title={ui('action.edit')}>
                <RiEditLine size={14} />
              </Button>
            </S.Row>
          ))}
        </S.List>
      )}

      {vm.editor && (
        <S.Editor>
          <S.EditorTitle>{vm.editor.title}</S.EditorTitle>
          <S.LocaleField>
            <Label>{t('portal.texts.language')}</Label>
            <SearchSelect options={vm.editor.localeOptions} value={vm.editor.locale} onChange={vm.setLocale} />
          </S.LocaleField>
          {vm.editor.missingInPackage && !vm.editor.edited && (
            <InfoBanner variant="warning" message={t('portal.texts.missing')} />
          )}
          <S.Panes>
            <S.Pane>
              <Label>{t('portal.texts.source')}</Label>
              <S.Source
                value={vm.editor.text}
                onChange={(event) => vm.setText(event.target.value)}
                placeholder={t('portal.texts.placeholder')}
                spellCheck
              />
              <S.Counter $over={vm.editor.overLimit}>{vm.editor.counter}</S.Counter>
            </S.Pane>
            <S.Pane>
              <Label>{t('portal.texts.preview')}</Label>
              <S.Preview>
                <PortalTemplateNodes nodes={vm.editor.preview} />
              </S.Preview>
            </S.Pane>
          </S.Panes>
          <S.Actions>
            <Button onClick={() => void vm.save()} disabled={!vm.editor.canSave}>
              {ui('action.save')}
            </Button>
            {vm.editor.edited && (
              <Button variant="secondary" onClick={vm.requestRestore} disabled={vm.saving}>
                {t('portal.texts.restore')}
              </Button>
            )}
            <Button variant="ghost" onClick={vm.close}>
              {ui('action.close')}
            </Button>
          </S.Actions>
        </S.Editor>
      )}

      <ConfirmModal
        isOpen={vm.restoreOpen}
        onConfirm={() => void vm.confirmRestore()}
        onCancel={vm.cancelRestore}
        title={t('portal.texts.restore.title')}
        message={t('portal.texts.restore.message', { language: vm.restoreLanguage })}
        confirmLabel={t('portal.texts.restore')}
        variant="danger"
      />
    </S.Container>
  );
};
