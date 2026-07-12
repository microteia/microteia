import styled from 'styled-components';

export const S = {
  MappingRow: styled.div`
    display: grid;
    grid-template-columns: 160px 1fr;
    gap: ${({ theme }) => theme.spacing.sm};
    align-items: start;

    @media (max-width: 480px) {
      grid-template-columns: 1fr;
    }
  `,

  OutputPickerRow: styled.div`
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: ${({ theme }) => theme.spacing.sm};
  `,
};
