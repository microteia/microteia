import React from 'react';
import { RiFileCopyLine, RiCheckLine } from 'react-icons/ri';
import { useCopyButtonViewModel } from './CopyButton.viewmodel';
import { S } from './CopyButton.styles';

import { useT } from '../../../shared/i18n/useT';

interface CopyButtonProps {
  text: string;
  size?: number;
}

export const CopyButton: React.FC<CopyButtonProps> = ({ text, size = 15 }) => {
  const vm = useCopyButtonViewModel(text);
  const t = useT('core.ui');

  return (
    <S.Button
      $copied={vm.copied}
      onClick={vm.handleCopy}
      title={t(vm.copied ? 'action.copied' : 'action.copy')}
    >
      {vm.copied ? <RiCheckLine size={size} /> : <RiFileCopyLine size={size} />}
    </S.Button>
  );
};
