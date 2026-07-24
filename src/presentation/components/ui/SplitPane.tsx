import React, { useCallback, useRef, useState } from 'react';
import styled from 'styled-components';

/**
 * Dois painéis lado a lado com uma divisória arrastável. Componente autocontido de propósito: ele é
 * o dono do `ref` do contêiner e só lê `ref.current` DENTRO do handler de arrasto (nunca no render),
 * o que satisfaz a regra `react-hooks/refs`. Expor esse ref por um ViewModel contaminaria o objeto do
 * VM inteiro para a regra — por isso a lógica de arrasto vive aqui, não num hook devolvido à View.
 */
interface SplitPaneProps {
  left: React.ReactNode;
  right: React.ReactNode;
  /** Quando falso, o painel esquerdo ocupa tudo e a divisória/painel direito somem. */
  showRight: boolean;
  initialLeftPct?: number;
  minPct?: number;
  maxPct?: number;
  className?: string;
}

const Container = styled.div`
  display: flex;
  align-items: stretch;
  width: 100%;
  height: 100%;
`;

const Pane = styled.div`
  min-width: 0;
  height: 100%;
  overflow: hidden;
`;

const Divider = styled.div`
  width: 6px;
  flex-shrink: 0;
  cursor: col-resize;
  background: ${({ theme }) => theme.colors.border};
  transition: background ${({ theme }) => theme.transitions.fast};

  &:hover { background: ${({ theme }) => theme.colors.primary}; }
`;

export const SplitPane: React.FC<SplitPaneProps> = ({
  left, right, showRight, initialLeftPct = 55, minPct = 25, maxPct = 80, className,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [leftPct, setLeftPct] = useState(initialLeftPct);

  const onDividerMouseDown = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    const onMove = (moveEvent: MouseEvent) => {
      const element = containerRef.current;
      if (!element) return;
      const rect = element.getBoundingClientRect();
      if (rect.width === 0) return;
      const pct = ((moveEvent.clientX - rect.left) / rect.width) * 100;
      setLeftPct(Math.min(maxPct, Math.max(minPct, pct)));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [minPct, maxPct]);

  return (
    <Container ref={containerRef} className={className}>
      <Pane style={showRight ? { width: `${leftPct}%` } : { width: '100%' }}>{left}</Pane>
      {showRight && (
        <>
          <Divider onMouseDown={onDividerMouseDown} />
          <Pane style={{ width: `${100 - leftPct}%` }}>{right}</Pane>
        </>
      )}
    </Container>
  );
};
