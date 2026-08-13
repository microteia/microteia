import styled from 'styled-components';

export const S = {
  Frame: styled.div<{ $height: number }>`
    width: 100%;
    height: ${({ $height }) => $height}px;
  `,

  Placeholder: styled.div`
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: ${({ theme }) => theme.colors.textMuted};
    font-size: ${({ theme }) => theme.fontSizes.xs};
  `,
};
