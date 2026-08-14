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
import { useT } from '../../../shared/i18n/useT';

export type { MarkdownEditorProps };

export const MarkdownEditor: React.FC<MarkdownEditorProps> = (props) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const contentAreaRef = useRef<HTMLDivElement>(null);
  const vm = useMarkdownEditorViewModel(props, textareaRef, contentAreaRef);

  const showEdit    = vm.mode === 'edit' || vm.mode === 'split';
  const showPreview = vm.mode === 'preview' || vm.mode === 'split';
  const t = useT('core.ui');
  const showResizer = vm.mode === 'split';

  const editFlex    = vm.mode === 'split' ? vm.splitRatio : 1;
  const previewFlex = vm.mode === 'split' ? (1 - vm.splitRatio) : 1;

  return (
    <>
      <S.Container>
        {!props.readOnly && (
          <S.Toolbar>
            <S.ToolBtn title={t('markdown.bold')} onClick={() => vm.insertFormat('**')}>
              <RiBold size={14} />
            </S.ToolBtn>
            <S.ToolBtn title={t('markdown.italic')} onClick={() => vm.insertFormat('*')}>
              <RiItalic size={14} />
            </S.ToolBtn>
            <S.ToolBtn title={t('markdown.underline')} onClick={() => vm.insertFormat('<u>', '</u>')}>
              <RiUnderline size={14} />
            </S.ToolBtn>
            <S.ToolBtn title={t('markdown.strikethrough')} onClick={() => vm.insertFormat('~~')}>
              <RiStrikethrough size={14} />
            </S.ToolBtn>

            <S.Separator />

            <S.ToolBtn title={t('markdown.list.ordered')} onClick={() => vm.insertLinePrefix('1. ')}>
              <RiListOrdered size={14} />
            </S.ToolBtn>
            <S.ToolBtn title={t('markdown.list.bullet')} onClick={() => vm.insertLinePrefix('- ')}>
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
              <S.ModeBtn $active={vm.mode === 'edit'} onClick={() => vm.setMode('edit')} title={t('markdown.mode.edit.title')}>
                <RiEditLine size={13} /> {t('markdown.mode.edit')}
              </S.ModeBtn>
              <S.ModeBtn $active={vm.mode === 'split'} onClick={() => vm.setMode('split')} title={t('markdown.mode.split.title')}>
                <RiLayoutColumnLine size={13} /> {t('markdown.mode.split')}
              </S.ModeBtn>
              <S.ModeBtn $active={vm.mode === 'preview'} onClick={() => vm.setMode('preview')} title={t('markdown.mode.preview.title')}>
                <RiEyeLine size={13} /> {t('markdown.mode.preview')}
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
              placeholder={props.placeholder ?? t('markdown.placeholder')}
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
                {props.placeholder ?? t('markdown.preview.empty')}
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
