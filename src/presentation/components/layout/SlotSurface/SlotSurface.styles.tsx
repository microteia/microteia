import styled from 'styled-components';

const Row = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  min-width: 0;
`;

const Item = styled.div`
  display: flex;
  align-items: center;
  min-width: 0;
`;

const Failure = styled.span`
  display: flex;
  align-items: center;
  color: ${({ theme }) => theme.colors.danger};
  font-size: ${({ theme }) => theme.fontSizes.xs};
`;

export const S = {
  Row,
  Item,
  Failure,
};
