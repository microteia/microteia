import styled from 'styled-components';
import { Textarea } from '../../../../components/ui/Input';

export const S = {
  Container: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.md};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    padding: ${({ theme }) => theme.spacing.md};
    background: ${({ theme }) => theme.colors.surface};
  `,

  Section: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.xs};
  `,

  SectionTitle: styled.span`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.textMuted};
    text-transform: uppercase;
    letter-spacing: 0.04em;
  `,

  RequestLine: styled.div`
    display: grid;
    grid-template-columns: 140px 1fr;
    gap: ${({ theme }) => theme.spacing.sm};
    align-items: start;

    @media (max-width: 560px) {
      grid-template-columns: 1fr;
    }
  `,

  FieldRow: styled.div`
    display: grid;
    grid-template-columns: 1fr 1.6fr auto;
    gap: ${({ theme }) => theme.spacing.sm};
    align-items: start;

    @media (max-width: 560px) {
      grid-template-columns: 1fr;
    }
  `,

  OptionsRow: styled.div`
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: ${({ theme }) => theme.spacing.sm};
    align-items: start;

    @media (max-width: 560px) {
      grid-template-columns: 1fr;
    }
  `,

  AddButton: styled.button`
    align-self: flex-start;
    display: inline-flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.xs};
    padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.sm};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    border: 1px dashed ${({ theme }) => theme.colors.border};
    background: transparent;
    color: ${({ theme }) => theme.colors.primary};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    cursor: pointer;
    transition: ${({ theme }) => theme.transitions.fast};

    &:hover {
      border-color: ${({ theme }) => theme.colors.primary};
    }
  `,

  RemoveButton: styled.button`
    width: 34px;
    height: 34px;
    border-radius: ${({ theme }) => theme.borderRadius.md};
    border: 1px solid ${({ theme }) => theme.colors.border};
    background: ${({ theme }) => theme.colors.surface};
    color: ${({ theme }) => theme.colors.textMuted};
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    flex-shrink: 0;
    transition: ${({ theme }) => theme.transitions.fast};

    &:hover {
      background: ${({ theme }) => theme.colors.danger};
      color: ${({ theme }) => theme.colors.white};
      border-color: ${({ theme }) => theme.colors.danger};
    }
  `,

  Empty: styled.p`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
    margin: 0;
  `,

  HelpText: styled.p`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
    margin: 0;
  `,

  Sample: styled(Textarea)`
    font-family: ${({ theme }) => theme.fonts.mono};
    min-height: 120px;
  `,

  Messages: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.xs};
  `,
};
