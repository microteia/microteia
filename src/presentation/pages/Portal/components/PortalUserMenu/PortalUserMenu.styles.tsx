import styled from 'styled-components';

export const S = {
  Wrapper: styled.div`
    position: relative;
  `,

  Trigger: styled.button<{ $open: boolean }>`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
    padding: 4px;
    border-radius: ${({ theme }) => theme.borderRadius.full};
    background: ${({ theme, $open }) => ($open ? theme.colors.surfaceHover : 'transparent')};
    transition: background ${({ theme }) => theme.transitions.fast};

    &:hover {
      background: ${({ theme }) => theme.colors.surfaceHover};
    }
  `,

  Avatar: styled.span`
    width: 32px;
    height: 32px;
    border-radius: ${({ theme }) => theme.borderRadius.full};
    background: ${({ theme }) => theme.colors.primaryLight};
    color: ${({ theme }) => theme.colors.primary};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-weight: 700;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    flex-shrink: 0;
  `,

  AvatarImg: styled.img`
    width: 100%;
    height: 100%;
    object-fit: cover;
  `,

  Panel: styled.div`
    position: absolute;
    right: 0;
    top: calc(100% + 8px);
    width: 264px;
    max-width: calc(100vw - 24px);
    padding: ${({ theme }) => theme.spacing.xs};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    border: 1px solid ${({ theme }) => theme.colors.border};
    background: ${({ theme }) => theme.colors.surface};
    box-shadow: 0 12px 32px ${({ theme }) => theme.colors.shadow};
    z-index: 40;
  `,

  Identity: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
    padding: ${({ theme }) => theme.spacing.sm};
  `,

  IdentityText: styled.div`
    min-width: 0;
  `,

  Name: styled.div`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,

  Email: styled.div`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,

  Divider: styled.div`
    height: 1px;
    margin: ${({ theme }) => theme.spacing.xs} 0;
    background: ${({ theme }) => theme.colors.borderSubtle};
  `,

  SectionLabel: styled.div`
    padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.sm};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: ${({ theme }) => theme.colors.textMuted};
  `,

  Item: styled.button<{ $active?: boolean }>`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
    width: 100%;
    padding: ${({ theme }) => theme.spacing.sm};
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme, $active }) => ($active ? theme.colors.text : theme.colors.textSecondary)};
    font-weight: ${({ $active }) => ($active ? 600 : 500)};
    text-align: left;

    &:hover {
      background: ${({ theme }) => theme.colors.surfaceHover};
      color: ${({ theme }) => theme.colors.text};
    }
  `,

  Swatch: styled.span<{ $background: string; $primary: string }>`
    width: 16px;
    height: 16px;
    border-radius: ${({ theme }) => theme.borderRadius.full};
    border: 1px solid ${({ theme }) => theme.colors.border};
    background: linear-gradient(135deg, ${({ $background }) => $background} 50%, ${({ $primary }) => $primary} 50%);
    flex-shrink: 0;
  `,

  Check: styled.span`
    margin-left: auto;
    color: ${({ theme }) => theme.colors.primary};
    display: inline-flex;
  `,
};
