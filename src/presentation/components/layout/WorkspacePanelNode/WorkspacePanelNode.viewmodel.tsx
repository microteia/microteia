import { useRef, useCallback } from 'react';
import { useWorkspace } from '../../../../stores/useWorkspace';
import type { PanelSplit } from '../../../../stores/useWorkspace';

export interface SplitResizerViewModel {
  containerRef: React.RefObject<HTMLDivElement>;
  handleResizerMouseDown: (e: React.MouseEvent, node: PanelSplit) => void;
}

export const useSplitResizerViewModel = (): SplitResizerViewModel => {
  const { updateSplitRatio } = useWorkspace();
  const containerRef = useRef<HTMLDivElement>(null!);

  const handleResizerMouseDown = useCallback((e: React.MouseEvent, node: PanelSplit) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const pos = node.direction === 'horizontal'
        ? moveEvent.clientX - rect.left
        : moveEvent.clientY - rect.top;
      const size = node.direction === 'horizontal' ? rect.width : rect.height;
      const ratio = Math.max(0.12, Math.min(0.88, pos / size));
      updateSplitRatio(node.id, ratio);
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [updateSplitRatio]);

  return { containerRef, handleResizerMouseDown };
};
