import { useCallback } from 'react';
import type { ScreenDefinition } from '../../../domain/entities';
import { useLabel, useT } from '../i18n/useT';

export type NewRecordTitleScreen = Pick<ScreenDefinition, 'titleSingular' | 'titleNew'>;

/**
 * O título do registro novo de uma tela — a aba, o cabeçalho do formulário e o botão de criar.
 *
 * Um caminho só porque eram quatro cópias de `t('record.new.title', …)`: a frase que a tela declara
 * (`titleNew`, #45) só valeria nas que alguém lembrasse de trocar, e a aba diria "Nova empresa"
 * enquanto o cabeçalho continuava "Novo Empresa".
 */
export const useNewRecordTitle = (): ((screen: NewRecordTitleScreen) => string) => {
  const t = useT('core.records');
  const label = useLabel();
  return useCallback(
    (screen: NewRecordTitleScreen) => (screen.titleNew
      ? label(screen.titleNew)
      : t('record.new.title', { entity: label(screen.titleSingular) })),
    [t, label],
  );
};
