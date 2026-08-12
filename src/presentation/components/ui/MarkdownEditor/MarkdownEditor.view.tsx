import React, { useRef } from 'react';
import {
  RiEditLine,
  RiLayoutColumnLine,
  RiEyeLine,
  RiBold,
  RiItalic,
  RiStrikethrough,
  RiUnderline,
  RiListOrdered,
  RiListUnordered,
} from 'react-icons/ri';
import { useMarkdownEditorViewModel, HIGHLIGHT_COLORS } from './MarkdownEditor.viewmodel';
import type { MarkdownEditorProps } from './MarkdownEditor.viewmodel';
import { S } from './MarkdownEditor.styles';
import { MentionMenu } from '../MentionMenu';
import { ExtensionMentionModal } from '../ExtensionMentionModal';
import { WorkflowMentionModal } from '../WorkflowMentionModal';
import { MarkdownContent } from '../MarkdownContent';

export type { MarkdownEditorProps };

export const MarkdownEditor: React.FC<MarkdownEditorProps> = (props) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const contentAreaRef = useRef<HTMLDivElement>(null);
  const vm = useMarkdownEditorViewModel(props, textareaRef, contentAreaRef);

  const showEdit    = vm.mode === 'edit' || vm.mode === 'split';
  const showPreview = vm.mode === 'preview' || vm.mode === 'split';
  const showResizer = vm.mode === 'split';

  const editFlex    = vm.mode === 'split' ? vm.splitRatio : 1;
  const previewFlex = vm.mode === 'split' ? (1 - vm.splitRatio) : 1;

  return (
    <>
      <S.Container>
        {!props.readOnly && (
          <S.Toolbar>
            <S.ToolBtn title="Negrito" onClick={() => vm.insertFormat('**')}>
              <RiBold size={14} />
            </S.ToolBtn>
            <S.ToolBtn title="Itálico" onClick={() => vm.insertFormat('*')}>
              <RiItalic size={14} />
            </S.ToolBtn>
            <S.ToolBtn title="Sublinhado" onClick={() => vm.insertFormat('<u>', '</u>')}>
              <RiUnderline size={14} />
            </S.ToolBtn>
            <S.ToolBtn title="Tachado" onClick={() => vm.insertFormat('~~')}>
              <RiStrikethrough size={14} />
            </S.ToolBtn>

            <S.Separator />

            <S.ToolBtn title="Lista numerada" onClick={() => vm.insertLinePrefix('1. ')}>
              <RiListOrdered size={14} />
            </S.ToolBtn>
            <S.ToolBtn title="Lista com marcadores" onClick={() => vm.insertLinePrefix('- ')}>
              <RiListUnordered size={14} />
            </S.ToolBtn>

            <S.Separator />

            {HIGHLIGHT_COLORS.map((c) => (
              <S.ColorDot
                key={c.value}
                $color={c.value}
                title={`Destacar: ${c.label}`}
                onClick={() => vm.applyHighlight(c.value)}
              />
            ))}

            <S.ModeGroup>
              <S.ModeBtn $active={vm.mode === 'edit'} onClick={() => vm.setMode('edit')} title="Somente edição">
                <RiEditLine size={13} /> Editar
              </S.ModeBtn>
              <S.ModeBtn $active={vm.mode === 'split'} onClick={() => vm.setMode('split')} title="Edição + prévia">
                <RiLayoutColumnLine size={13} /> Dividir
              </S.ModeBtn>
              <S.ModeBtn $active={vm.mode === 'preview'} onClick={() => vm.setMode('preview')} title="Somente prévia">
                <RiEyeLine size={13} /> Prévia
              </S.ModeBtn>
            </S.ModeGroup>
          </S.Toolbar>
        )}

        <S.ContentArea $mode={vm.mode} ref={contentAreaRef}>
          <S.EditPane $flex={editFlex} $visible={showEdit}>
            <S.Textarea
              ref={textareaRef}
              value={props.value}
              onChange={vm.handleTextareaChange}
              onKeyDown={vm.handleTextareaKeyDown}
              placeholder={props.placeholder ?? 'Digite em Markdown... (@ para inserir links)'}
              spellCheck={false}
            />
          </S.EditPane>

          {showResizer && (
            <S.Resizer onMouseDown={vm.handleResizerMouseDown} />
          )}

          <S.PreviewPane $flex={previewFlex} $visible={showPreview}>
            {props.value ? (
              <MarkdownContent>{props.value}</MarkdownContent>
            ) : (
              <S.EmptyPreview>
                {props.placeholder ?? 'A prévia aparecerá aqui...'}
              </S.EmptyPreview>
            )}
          </S.PreviewPane>
        </S.ContentArea>
      </S.Container>

      <MentionMenu
        active={vm.mentionState.active}
        query={vm.mentionState.query}
        highlightedIndex={vm.mentionHighlightedIndex}
        position={vm.mentionState.position}
        onSelect={vm.selectMentionCommand}
        onHover={vm.onMentionHover}
        commands={vm.mentionCommands}
      />

      {vm.extMentionProvider && (
        <ExtensionMentionModal
          provider={vm.extMentionProvider}
          onSelect={vm.insertExtMentionLink}
          onClose={vm.closeExtMention}
        />
      )}



      {vm.workflowPickerOpen && (
        <WorkflowMentionModal
          onClose={vm.closeWorkflowPicker}
          onSelect={vm.insertWorkflowLink}
        />
      )}
    </>
  );
};
