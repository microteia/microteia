import styled from 'styled-components';
import type { EditorMode } from './MarkdownEditor.viewmodel';

export const S = {
  Container: styled.div`
    display: flex;
    flex-direction: column;
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    overflow: hidden;
    background: ${({ theme }) => theme.colors.surface};
  `,

  Toolbar: styled.div`
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 6px 10px;
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
    background: ${({ theme }) => theme.colors.background};
    flex-wrap: wrap;
  `,

  ToolBtn: styled.button`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 28px;
    border: none;
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    background: transparent;
    color: ${({ theme }) => theme.colors.textSecondary};
    font-size: 0.8125rem;
    font-weight: 700;
    cursor: pointer;
    transition: all ${({ theme }) => theme.transitions.fast};
    font-family: ${({ theme }) => theme.fonts.body};

    &:hover {
      background: ${({ theme }) => theme.colors.primaryLight};
      color: ${({ theme }) => theme.colors.primary};
    }
  `,

  Separator: styled.div`
    width: 1px;
    height: 18px;
    background: ${({ theme }) => theme.colors.border};
    margin: 0 4px;
    flex-shrink: 0;
  `,

  ColorDot: styled.button<{ $color: string }>`
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: ${({ $color }) => $color};
    border: 2px solid transparent;
    cursor: pointer;
    flex-shrink: 0;
    transition: transform ${({ theme }) => theme.transitions.fast};

    &:hover {
      transform: scale(1.25);
      border-color: rgba(255, 255, 255, 0.6);
    }
  `,

  ModeGroup: styled.div`
    display: flex;
    align-items: center;
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    overflow: hidden;
    margin-left: auto;
  `,

  ModeBtn: styled.button<{ $active: boolean }>`
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 4px 10px;
    font-size: 0.75rem;
    font-weight: 500;
    border: none;
    background: ${({ theme, $active }) =>
      $active ? theme.colors.primary : 'transparent'};
    color: ${({ theme, $active }) =>
      $active ? '#fff' : theme.colors.textSecondary};
    cursor: pointer;
    transition: all ${({ theme }) => theme.transitions.fast};
    font-family: ${({ theme }) => theme.fonts.body};

    &:hover {
      background: ${({ theme, $active }) =>
        $active ? theme.colors.primaryHover : theme.colors.primaryLight};
      color: ${({ theme, $active }) =>
        $active ? '#fff' : theme.colors.primary};
    }

    & + & {
      border-left: 1px solid ${({ theme }) => theme.colors.border};
    }
  `,

  ContentArea: styled.div<{ $mode: EditorMode }>`
    display: flex;
    flex-direction: row;
    flex: 1;
    min-height: 240px;
    overflow: hidden;
  `,

  EditPane: styled.div<{ $flex: number; $visible: boolean }>`
    display: ${({ $visible }) => ($visible ? 'flex' : 'none')};
    flex: ${({ $flex }) => $flex};
    flex-direction: column;
    min-width: 0;
    overflow: hidden;
  `,

  Textarea: styled.textarea`
    flex: 1;
    width: 100%;
    padding: 14px;
    border: none;
    outline: none;
    resize: none;
    background: transparent;
    color: ${({ theme }) => theme.colors.text};
    font-family: ${({ theme }) => theme.fonts.mono};
    font-size: 0.875rem;
    line-height: 1.7;
    min-height: 240px;

    &::placeholder {
      color: ${({ theme }) => theme.colors.textMuted};
      font-family: ${({ theme }) => theme.fonts.body};
      font-style: italic;
    }

    &::-webkit-scrollbar { width: 6px; }
    &::-webkit-scrollbar-track { background: transparent; }
    &::-webkit-scrollbar-thumb {
      background: ${({ theme }) => theme.colors.scrollbarThumb};
      border-radius: 3px;
    }
  `,

  Resizer: styled.div`
    flex-shrink: 0;
    width: 4px;
    cursor: col-resize;
    background: ${({ theme }) => theme.colors.border};
    transition: background ${({ theme }) => theme.transitions.fast};
    user-select: none;

    &:hover,
    &:active {
      background: ${({ theme }) => theme.colors.primary};
    }
  `,

  PreviewPane: styled.div<{ $flex: number; $visible: boolean }>`
    display: ${({ $visible }) => ($visible ? 'flex' : 'none')};
    flex: ${({ $flex }) => $flex};
    flex-direction: column;
    overflow-y: auto;
    padding: 14px 18px;
    color: ${({ theme }) => theme.colors.text};
    font-family: ${({ theme }) => theme.fonts.body};
    font-size: 0.875rem;
    line-height: 1.7;
    min-width: 0;
    min-height: 240px;

    &::-webkit-scrollbar { width: 6px; }
    &::-webkit-scrollbar-track { background: transparent; }
    &::-webkit-scrollbar-thumb {
      background: ${({ theme }) => theme.colors.scrollbarThumb};
      border-radius: 3px;
    }

    h1 { font-size: 1.25rem; font-weight: 700; margin: 0 0 10px; }
    h2 { font-size: 1.1rem; font-weight: 700; margin: 12px 0 8px; }
    h3 { font-size: 1rem; font-weight: 600; margin: 10px 0 6px; }
    p { margin: 0 0 8px; }
    p:last-child { margin-bottom: 0; }
    strong { font-weight: 700; }
    em { font-style: italic; }
    s, del { text-decoration: line-through; }
    u { text-decoration: underline; }
    a, [role="link"] {
      color: ${({ theme }) => theme.colors.primary};
      text-decoration: underline;
      text-decoration-color: ${({ theme }) => theme.colors.primary};
      text-underline-offset: 2px;
      cursor: pointer;
      &:hover { opacity: 0.75; }
    }
    ul, ol { margin: 6px 0 10px; padding-left: 22px; }
    li { margin-bottom: 4px; }
    code {
      font-family: ${({ theme }) => theme.fonts.mono};
      font-size: 0.8125rem;
      background: ${({ theme }) => theme.colors.inputBackground};
      padding: 1px 5px;
      border-radius: 4px;
    }
    blockquote {
      border-left: 3px solid ${({ theme }) => theme.colors.primary};
      margin: 8px 0;
      padding-left: 12px;
      color: ${({ theme }) => theme.colors.textSecondary};
      font-style: italic;
    }
    mark { padding: 1px 3px; border-radius: 3px; }
  `,

  EmptyPreview: styled.div`
    color: ${({ theme }) => theme.colors.textMuted};
    font-style: italic;
    font-size: 0.875rem;
  `,
};
