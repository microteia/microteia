import styled from 'styled-components';

interface BadgeProps {
  color?: string;
}

export const Badge = styled.span<BadgeProps>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border-radius: ${({ theme }) => theme.borderRadius.full};
  font-size: ${({ theme }) => theme.fontSizes.xs};
  font-weight: 500;
  background: ${({ color }) => color ? `${color}22` : 'rgba(108, 99, 255, 0.15)'};
  color: ${({ color }) => color ?? '#6c63ff'};
  border: 1px solid ${({ color }) => color ? `${color}44` : 'rgba(108, 99, 255, 0.3)'};
`;

export const ColorDot = styled.span<{ color: string }>`
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: ${({ color }) => color};
  display: inline-block;
  flex-shrink: 0;
`;
