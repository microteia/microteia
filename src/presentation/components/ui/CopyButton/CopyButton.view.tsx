import React from 'react';
import { RiFileCopyLine, RiCheckLine } from 'react-icons/ri';
import { useCopyButtonViewModel } from './CopyButton.viewmodel';
import { S } from './CopyButton.styles';

interface CopyButtonProps {
  text: string;
  size?: number;
}

export const CopyButton: React.FC<CopyButtonProps> = ({ text, size = 15 }) => {
  const vm = useCopyButtonViewModel(text);

  return (
    <S.Button
      $copied={vm.copied}
      onClick={vm.handleCopy}
      title={vm.copied ? 'Copiado!' : 'Copiar'}
    >
      {vm.copied ? <RiCheckLine size={size} /> : <RiFileCopyLine size={size} />}
    </S.Button>
  );
};
