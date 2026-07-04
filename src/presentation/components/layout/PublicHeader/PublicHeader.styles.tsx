import styled from 'styled-components';

export const S = {
  Header: styled.header`
    position: sticky;
    top: 0;
    z-index: 40;
    background: ${({ theme }) => theme.colors.surface};
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  `,

  Bar: styled.div`
    max-width: 1200px;
    margin: 0 auto;
    padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.lg};
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: ${({ theme }) => theme.spacing.md};
  `,

  LogoButton: styled.button`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;

    img {
      width: 36px;
      height: 36px;
      object-fit: contain;
    }

    span {
      font-size: ${({ theme }) => theme.fontSizes.lg};
      font-weight: 700;
      color: ${({ theme }) => theme.colors.text};
    }
  `,

  Nav: styled.nav<{ $open: boolean }>`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.lg};

    @media (max-width: 768px) {
      position: fixed;
      top: 61px;
      left: 0;
      right: 0;
      z-index: 39;
      flex-direction: column;
      align-items: stretch;
      background: ${({ theme }) => theme.colors.surface};
      border-bottom: 1px solid ${({ theme }) => theme.colors.border};
      padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
      gap: ${({ theme }) => theme.spacing.md};
      display: ${({ $open }) => ($open ? 'flex' : 'none')};
    }
  `,

  NavLink: styled.button<{ $active: boolean }>`
    background: none;
    border: none;
    padding: ${({ theme }) => theme.spacing.xs} 0;
    cursor: pointer;
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 600;
    color: ${({ $active, theme }) => ($active ? theme.colors.primary : theme.colors.textSecondary)};
    transition: color ${({ theme }) => theme.transitions.fast};
    text-align: left;

    &:hover {
      color: ${({ theme }) => theme.colors.text};
    }
  `,

  EnterButton: styled.button`
    background: ${({ theme }) => theme.colors.primary};
    color: ${({ theme }) => theme.colors.white};
    border: none;
    border-radius: ${({ theme }) => theme.borderRadius.md};
    padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.lg};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 700;
    cursor: pointer;
    transition: background ${({ theme }) => theme.transitions.fast};

    &:hover {
      background: ${({ theme }) => theme.colors.primaryHover};
    }
  `,

  MenuToggle: styled.button`
    display: none;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    color: ${({ theme }) => theme.colors.text};
    cursor: pointer;

    @media (max-width: 768px) {
      display: flex;
    }
  `,
};
