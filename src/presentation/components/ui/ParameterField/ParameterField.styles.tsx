import styled from 'styled-components';

export const S = {
  JsonArea: styled.textarea`
    width: 100%;
    min-height: 90px;
    padding: ${({ theme }) => theme.spacing.md};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    background: ${({ theme }) => theme.colors.inputBackground};
    color: ${({ theme }) => theme.colors.text};
    font-family: ${({ theme }) => theme.fonts.mono};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    line-height: 1.6;
    resize: vertical;
    outline: none;

    &:focus {
      border-color: ${({ theme }) => theme.colors.primary};
    }
  `,
};
