import { useState, useCallback } from 'react';

export interface CopyButtonViewModel {
  copied: boolean;
  handleCopy: () => void;
}

export const useCopyButtonViewModel = (text: string): CopyButtonViewModel => {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [text]);

  return { copied, handleCopy };
};
