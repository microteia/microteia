import styled, { css } from 'styled-components';

/**
 * O designer se arranja pela largura que TEM, e não pela da janela: ele mora numa aba de um modal que
 * pode estar maximizado ou não. Largo, paleta, canvas e propriedades lado a lado; médio, a paleta e as
 * propriedades dividem a coluna da esquerda em abas; estreito, tudo empilhado.
 */
const WIDE = '@container template-designer (min-width: 980px)';
const NARROW = '@container template-designer (max-width: 560px)';

const selectedRing = css`
  border-color: ${({ theme }) => theme.colors.primary};
  box-shadow: 0 0 0 1px ${({ theme }) => theme.colors.primary};
`;

const invalidRing = css`
  border-color: ${({ theme }) => theme.colors.danger};
`;

export const S = {
  Designer: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.sm};
    container-type: inline-size;
    container-name: template-designer;
  `,

  Workspace: styled.div`
    display: grid;
    grid-template-columns: minmax(200px, 240px) minmax(0, 1fr);
    grid-template-rows: auto 1fr;
    grid-template-areas:
      'tabs canvas'
      'side canvas';
    column-gap: ${({ theme }) => theme.spacing.md};
    row-gap: ${({ theme }) => theme.spacing.sm};
    align-items: start;

    ${WIDE} {
      grid-template-columns: 200px minmax(0, 1fr) 300px;
      grid-template-rows: auto;
      grid-template-areas: 'palette canvas inspector';
    }

    ${NARROW} {
      grid-template-columns: minmax(0, 1fr);
      grid-template-areas:
        'tabs'
        'side'
        'canvas';
    }
  `,

  SideTabs: styled.div`
    grid-area: tabs;
    display: flex;
    gap: ${({ theme }) => theme.spacing.xs};
    padding: ${({ theme }) => theme.spacing.xs};
    background: ${({ theme }) => theme.colors.inputBackground};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.sm};

    ${WIDE} {
      display: none;
    }
  `,

  SideTab: styled.button<{ $active: boolean }>`
    flex: 1;
    border: none;
    cursor: pointer;
    padding: ${({ theme }) => `${theme.spacing.xs} ${theme.spacing.sm}`};
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-weight: 600;
    color: ${({ theme, $active }) => ($active ? theme.colors.text : theme.colors.textMuted)};
    background: ${({ theme, $active }) => ($active ? theme.colors.surface : 'transparent')};
  `,

  Side: styled.div<{ $active: boolean; $area: 'palette' | 'inspector' }>`
    grid-area: side;
    display: ${({ $active }) => ($active ? 'flex' : 'none')};
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.sm};
    min-width: 0;

    ${WIDE} {
      grid-area: ${({ $area }) => $area};
      display: flex;
    }
  `,

  SideTitle: styled.div`
    display: none;
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-weight: 600;
    text-transform: uppercase;
    color: ${({ theme }) => theme.colors.textMuted};

    ${WIDE} {
      display: block;
    }
  `,

  Hint: styled.div`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
  `,

  PaletteGroup: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.xs};
  `,

  GroupTitle: styled.div`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.textSecondary};
  `,

  PaletteItems: styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: ${({ theme }) => theme.spacing.xs};
  `,

  PaletteItem: styled.button`
    display: inline-flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.xs};
    max-width: 100%;
    padding: ${({ theme }) => `${theme.spacing.xs} ${theme.spacing.sm}`};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    background: ${({ theme }) => theme.colors.surface};
    color: ${({ theme }) => theme.colors.text};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    cursor: grab;
    transition: border-color ${({ theme }) => theme.transitions.fast};

    &:hover:not(:disabled) {
      border-color: ${({ theme }) => theme.colors.primary};
    }

    &:disabled {
      cursor: not-allowed;
      opacity: 0.5;
    }

    span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  `,

  CanvasColumn: styled.div`
    grid-area: canvas;
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.md};
    min-width: 0;
  `,

  Canvas: styled.div<{ $dragging: boolean }>`
    padding: ${({ theme }) => theme.spacing.md};
    border: 1px dashed ${({ theme, $dragging }) => ($dragging ? theme.colors.primary : theme.colors.border)};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    background: ${({ theme }) => theme.colors.background};
    outline: none;

    &:focus-visible {
      border-color: ${({ theme }) => theme.colors.primary};
    }
  `,

  CardShell: styled.div`
    display: flex;
    flex-direction: column;
    padding: ${({ theme }) => theme.spacing.md};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.lg};
    background: ${({ theme }) => theme.colors.surface};
    min-height: 120px;
  `,

  EmptyCanvas: styled.div`
    padding: ${({ theme }) => theme.spacing.md};
    text-align: center;
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.textMuted};
  `,

  NodeList: styled.div<{ $direction: 'row' | 'column' }>`
    display: flex;
    flex-direction: ${({ $direction }) => $direction};
    flex-wrap: ${({ $direction }) => ($direction === 'row' ? 'wrap' : 'nowrap')};
    align-items: ${({ $direction }) => ($direction === 'row' ? 'flex-start' : 'stretch')};
    min-width: 0;
  `,

  /** Ponto de soltura. Sempre presente, para que o layout não pule quando o arrasto começa. */
  Slot: styled.div<{ $direction: 'row' | 'column'; $dragging: boolean; $allowed: boolean; $active: boolean }>`
    flex-shrink: 0;
    ${({ $direction, theme }) => ($direction === 'row'
      ? css`width: ${theme.spacing.sm}; align-self: stretch;`
      : css`height: ${theme.spacing.sm};`)}
    border-radius: ${({ theme }) => theme.borderRadius.full};
    background: ${({ theme, $active, $allowed, $dragging }) => ($active
      ? theme.colors.primary
      : $dragging && $allowed ? theme.colors.primaryLight : 'transparent')};
    transition: background ${({ theme }) => theme.transitions.fast};
  `,

  Container: styled.div<{ $selected: boolean; $invalid: boolean; $dragging: boolean; $direction: 'row' | 'column' }>`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.xs};
    padding: ${({ theme }) => theme.spacing.xs};
    border: 1px dashed ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    background: ${({ theme }) => theme.colors.surface};
    min-width: 0;
    flex: ${({ $direction }) => ($direction === 'column' ? '1 1 auto' : '0 1 auto')};
    opacity: ${({ $dragging }) => ($dragging ? 0.4 : 1)};
    cursor: pointer;
    ${({ $invalid }) => $invalid && invalidRing}
    ${({ $selected }) => $selected && selectedRing}
  `,

  ContainerHeader: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.xs};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
    cursor: grab;
  `,

  EmptyContainer: styled.div`
    padding: ${({ theme }) => theme.spacing.sm};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
    text-align: center;
  `,

  Chip: styled.div<{ $selected: boolean; $invalid: boolean; $dragging: boolean }>`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.xs};
    min-width: 0;
    padding: ${({ theme }) => `${theme.spacing.xs} ${theme.spacing.sm}`};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    background: ${({ theme }) => theme.colors.inputBackground};
    color: ${({ theme }) => theme.colors.text};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    cursor: grab;
    opacity: ${({ $dragging }) => ($dragging ? 0.4 : 1)};
    transition: border-color ${({ theme }) => theme.transitions.fast};

    &:hover {
      border-color: ${({ theme }) => theme.colors.textMuted};
    }

    ${({ $invalid }) => $invalid && invalidRing}
    ${({ $selected }) => $selected && selectedRing}
  `,

  ChipLabel: styled.span`
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,

  ChipCaption: styled.span`
    color: ${({ theme }) => theme.colors.textMuted};
    white-space: nowrap;
  `,

  Marker: styled.span<{ $tone: 'muted' | 'danger' }>`
    display: inline-flex;
    flex-shrink: 0;
    color: ${({ theme, $tone }) => ($tone === 'danger' ? theme.colors.danger : theme.colors.textMuted)};
  `,

  InspectorHeader: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.xs};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text};
  `,

  Tools: styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: ${({ theme }) => theme.spacing.xs};
    padding-bottom: ${({ theme }) => theme.spacing.sm};
    border-bottom: 1px solid ${({ theme }) => theme.colors.borderSubtle};
  `,

  Tool: styled.button<{ $danger?: boolean }>`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: ${({ theme }) => theme.spacing.xs};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    background: ${({ theme }) => theme.colors.surface};
    color: ${({ theme, $danger }) => ($danger ? theme.colors.danger : theme.colors.text)};
    cursor: pointer;

    &:hover:not(:disabled) {
      background: ${({ theme }) => theme.colors.surfaceHover};
    }

    &:disabled {
      cursor: not-allowed;
      opacity: 0.4;
    }
  `,

  Property: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.xs};
    min-width: 0;
  `,

  PropertyLabel: styled.div`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.textSecondary};
  `,

  PropertyError: styled.div`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.danger};
  `,

  Segmented: styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: ${({ theme }) => theme.spacing.xs};
  `,

  Segment: styled.button<{ $active: boolean }>`
    flex: 1 1 auto;
    border: 1px solid ${({ theme, $active }) => ($active ? theme.colors.primary : theme.colors.border)};
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    padding: ${({ theme }) => `${theme.spacing.xs} ${theme.spacing.sm}`};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    cursor: pointer;
    white-space: nowrap;
    color: ${({ theme, $active }) => ($active ? theme.colors.primary : theme.colors.text)};
    background: ${({ theme, $active }) => ($active ? theme.colors.primaryLight : theme.colors.surface)};
    font-weight: ${({ $active }) => ($active ? 600 : 400)};
  `,
};
