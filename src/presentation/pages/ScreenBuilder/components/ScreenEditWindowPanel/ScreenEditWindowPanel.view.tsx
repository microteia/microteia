import React from 'react';
import { S } from './ScreenEditWindowPanel.styles';
import { Checkbox } from '../../../../components/ui/Checkbox';
import { InfoBanner } from '../../../../components/ui/InfoBanner';
import { Input, InputGroup, Label } from '../../../../components/ui/Input';
import { useT } from '../../../../shared/i18n/useT';
import type { EditWindowFormState } from './screenEditWindowForm';

export interface ScreenEditWindowPanelProps {
  form: EditWindowFormState;
  /** A tela veio de uma extensão: o prazo que ela declarar vence na próxima atualização. */
  fromExtension: boolean;
  onChange: (patch: Partial<EditWindowFormState>) => void;
}

/** A aba "Prazo para alteração" da tela: por quanto tempo um registro ainda muda. Só desenha o que recebe. */
export const ScreenEditWindowPanel: React.FC<ScreenEditWindowPanelProps> = ({ form, fromExtension, onChange }) => {
  const t = useT('core.records');
  return (
    <S.Panel>
      <InfoBanner variant="info" message={t('edit-window.panel.description')} />
      {fromExtension && <InfoBanner variant="warning" message={t('edit-window.panel.from-extension')} />}
      <Checkbox
        label={t('edit-window.panel.enabled')}
        checked={form.enabled}
        onChange={(enabled) => onChange({ enabled })}
      />
      {form.enabled && (
        <>
          <InputGroup>
            <Label>{t('edit-window.panel.minutes')}</Label>
            <Input
              type="number"
              min={1}
              step={1}
              value={form.minutes}
              onChange={(event) => onChange({ minutes: event.target.value })}
            />
            <S.Hint>{t('edit-window.panel.minutes.hint')}</S.Hint>
          </InputGroup>
          <Checkbox
            label={t('edit-window.panel.delete')}
            checked={form.locksDelete}
            onChange={(locksDelete) => onChange({ locksDelete })}
          />
        </>
      )}
    </S.Panel>
  );
};
