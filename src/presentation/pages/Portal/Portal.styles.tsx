import styled from 'styled-components';

export const S = {
  Page: styled.div`
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    background: ${({ theme }) => theme.colors.background};
    color: ${({ theme }) => theme.colors.text};
  `,

  Header: styled.header`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: ${({ theme }) => theme.spacing.md};
    padding: ${({ theme }) => theme.spacing.md};
    background: ${({ theme }) => theme.colors.surface};
    border-bottom: 1px solid ${({ theme }) => theme.colors.borderSubtle};
  `,

  Brand: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
    min-width: 0;
  `,

  Logo: styled.img`
    width: 32px;
    height: 32px;
    object-fit: contain;
    border-radius: ${({ theme }) => theme.borderRadius.sm};
  `,

  BrandName: styled.span`
    font-size: ${({ theme }) => theme.fontSizes.lg};
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,

  HeaderActions: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
    flex-shrink: 0;
  `,

  Nav: styled.nav`
    display: flex;
    gap: ${({ theme }) => theme.spacing.xs};
    padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
    overflow-x: auto;
    border-bottom: 1px solid ${({ theme }) => theme.colors.borderSubtle};
  `,

  NavItem: styled.button<{ $active: boolean }>`
    display: inline-flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.xs};
    padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
    border: none;
    border-radius: ${({ theme }) => theme.borderRadius.full};
    background: ${({ theme, $active }) => ($active ? theme.colors.primaryLight : 'transparent')};
    color: ${({ theme, $active }) => ($active ? theme.colors.primary : theme.colors.textSecondary)};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 500;
    white-space: nowrap;
    cursor: pointer;
    transition: background ${({ theme }) => theme.transitions.fast};

    &:hover {
      background: ${({ theme }) => theme.colors.surfaceHover};
    }
  `,

  Main: styled.main`
    flex: 1;
    width: 100%;
    max-width: 960px;
    margin: 0 auto;
    padding: ${({ theme }) => theme.spacing.md};
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.md};
  `,

  Centered: styled.div`
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: ${({ theme }) => theme.spacing.md};
    padding: ${({ theme }) => theme.spacing.xl} ${({ theme }) => theme.spacing.md};
    text-align: center;
    color: ${({ theme }) => theme.colors.textSecondary};
  `,

  Title: styled.h1`
    font-size: ${({ theme }) => theme.fontSizes['2xl']};
    font-weight: 700;
    color: ${({ theme }) => theme.colors.text};
  `,

  Muted: styled.p`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.textMuted};
  `,

  List: styled.div`
    display: grid;
    gap: ${({ theme }) => theme.spacing.sm};
  `,

  Card: styled.button`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.xs};
    width: 100%;
    padding: ${({ theme }) => theme.spacing.md};
    text-align: left;
    background: ${({ theme }) => theme.colors.surface};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.lg};
    color: ${({ theme }) => theme.colors.text};
    cursor: pointer;
    transition: background ${({ theme }) => theme.transitions.fast};

    &:hover {
      background: ${({ theme }) => theme.colors.cardHover};
    }
  `,

  CardTitle: styled.span`
    font-size: ${({ theme }) => theme.fontSizes.md};
    font-weight: 600;
  `,

  CardMeta: styled.span`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.textSecondary};
  `,

  Detail: styled.section`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.md};
    padding: ${({ theme }) => theme.spacing.lg};
    background: ${({ theme }) => theme.colors.surface};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.lg};
  `,

  DetailTitle: styled.h2`
    font-size: ${({ theme }) => theme.fontSizes.xl};
    font-weight: 700;
  `,

  Fields: styled.dl`
    display: grid;
    grid-template-columns: 1fr;
    gap: ${({ theme }) => theme.spacing.md};

    @media (min-width: 640px) {
      grid-template-columns: 1fr 1fr;
    }
  `,

  Field: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.xs};
    min-width: 0;
  `,

  FieldLabel: styled.dt`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
    text-transform: uppercase;
    letter-spacing: 0.04em;
  `,

  FieldValue: styled.dd`
    font-size: ${({ theme }) => theme.fontSizes.md};
    color: ${({ theme }) => theme.colors.text};
    overflow-wrap: anywhere;
    white-space: pre-wrap;
  `,

  Link: styled.a`
    color: ${({ theme }) => theme.colors.primary};
  `,

  SectionTitle: styled.h3`
    font-size: ${({ theme }) => theme.fontSizes.md};
    font-weight: 600;
    padding-top: ${({ theme }) => theme.spacing.sm};
    border-top: 1px solid ${({ theme }) => theme.colors.borderSubtle};
  `,

  DocumentRow: styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: ${({ theme }) => theme.spacing.sm};
    padding: ${({ theme }) => theme.spacing.sm} 0;
    border-bottom: 1px solid ${({ theme }) => theme.colors.borderSubtle};
  `,

  DocumentInfo: styled.div`
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  `,

  DocumentName: styled.span`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,

  ErrorText: styled.p`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.danger};
  `,
};
