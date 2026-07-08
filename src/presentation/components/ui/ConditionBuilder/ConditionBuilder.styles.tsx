import styled from 'styled-components';

export const S = {
  Container: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.lg};
  `,

  Section: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.md};
  `,

  SectionTitle: styled.h3`
    font-size: ${({ theme }) => theme.fontSizes.md};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text};
    margin: 0;
  `,

  RadioGroup: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.sm};
  `,

  RadioOption: styled.label`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
    cursor: pointer;
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.text};

    input[type='radio'] {
      cursor: pointer;
    }

    label {
      cursor: pointer;
    }
  `,

  ConditionsContainer: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.md};
  `,

  ConditionCard: styled.div`
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    padding: ${({ theme }) => theme.spacing.md};
    background: ${({ theme }) => theme.colors.backgroundSecondary};
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.md};
  `,

  ConditionHeader: styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
  `,

  ConditionLabel: styled.div`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text};
  `,

  RemoveButton: styled.button`
    background: transparent;
    border: none;
    padding: ${({ theme }) => theme.spacing.xs};
    cursor: pointer;
    color: ${({ theme }) => theme.colors.danger};
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    transition: background-color 0.2s;

    &:hover {
      background: ${({ theme }) => theme.colors.dangerLight};
    }
  `,

  ConditionRow: styled.div`
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: ${({ theme }) => theme.spacing.md};

    @media (max-width: 768px) {
      grid-template-columns: 1fr;
    }
  `,

  FieldGroup: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.xs};
  `,

  Label: styled.label`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 500;
    color: ${({ theme }) => theme.colors.textMuted};
  `,

  ValueTypeRow: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.md};
    flex-wrap: wrap;
  `,

  AddButton: styled.button`
    background: transparent;
    border: 1px dashed ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    padding: ${({ theme }) => theme.spacing.md};
    cursor: pointer;
    color: ${({ theme }) => theme.colors.primary};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 500;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: ${({ theme }) => theme.spacing.xs};
    transition: all 0.2s;

    &:hover {
      background: ${({ theme }) => theme.colors.primaryLight};
      border-color: ${({ theme }) => theme.colors.primary};
    }
  `,

  HelpText: styled.p`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.textMuted};
    margin: 0;
    font-style: italic;
  `,
};
