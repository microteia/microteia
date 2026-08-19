import { useMemo } from 'react';
import { styled } from 'styled-components';
import { useCollection, useOpenScreenList } from '@microteia/data';

const Card = styled.div`
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  padding: ${({ theme }) => theme.spacing.lg};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
  height: 100%;
`;

const Title = styled.h3`
  font-size: ${({ theme }) => theme.fontSizes.md};
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text};
`;

const Stat = styled.button`
  background: none;
  border: none;
  padding: 0;
  text-align: left;
  cursor: pointer;
`;

const Value = styled.div`
  font-size: ${({ theme }) => theme.fontSizes['2xl']};
  font-weight: 700;
  line-height: 1.2;
  color: ${({ theme }) => theme.colors.text};
`;

const Label = styled.div`
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme }) => theme.colors.textMuted};
`;

export default function PessoasNumerosWidget() {
  const persons = useCollection('persons');
  const openList = useOpenScreenList();
  const ativas = useMemo(() => persons.filter((p) => p.status !== 'Inativo').length, [persons]);

  return (
    <Card>
      <Title>Pessoas</Title>
      <Stat onClick={() => openList('persons', [{ key: 'status', values: ['Ativo'] }])}>
        <Value>{ativas}</Value>
        <Label>Ativas</Label>
      </Stat>
    </Card>
  );
}
