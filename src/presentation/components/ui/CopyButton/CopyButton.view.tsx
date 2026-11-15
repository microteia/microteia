import React from 'react';
import { RiFileCopyLine, RiCheckLine } from 'react-icons/ri';
import { useCopyButtonViewModel } from './CopyButton.viewmodel';
import { S } from './CopyButton.styles';

import { useT } from '../../../shared/i18n/useT';

interface CopyButtonProps {
  text: string;
  size?: number;
  /**
   * Ao lado do texto, no fluxo da linha. Sem ele o botão flutua no canto do bloco que o contém — feito para
   * bloco de código; numa linha de texto, ele ia parar no canto de um ancestral qualquer, longe do que copia.
   */
  inline?: boolean;
}

export const CopyButton: React.FC<CopyButtonProps> = ({ text, size = 15, inline = false }) => {
  const vm = useCopyButtonViewModel(text);
  const t = useT('core.ui');

  return (
    <S.Button
      type="button"
      $copied={vm.copied}
      $inline={inline}
      onClick={vm.handleCopy}
      title={t(vm.copied ? 'action.copied' : 'action.copy')}
    >
      {vm.copied ? <RiCheckLine size={size} /> : <RiFileCopyLine size={size} />}
    </S.Button>
  );
};
