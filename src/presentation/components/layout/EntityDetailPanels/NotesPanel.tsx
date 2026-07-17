import React from 'react';
import {
  RiAddLine,
  RiArrowDownSLine,
  RiCloseLine,
  RiDeleteBinLine,
  RiFileTextLine,
} from 'react-icons/ri';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { S } from './panels.styles';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { Spinner } from '../../ui/Spinner';
import { ConfirmModal } from '../../ui/ConfirmModal';
import { MarkdownEditor } from '../../ui/MarkdownEditor';
import { MarkdownContent } from '../../ui/MarkdownContent';
import type { EntityNotesController } from '../../../shared/entityScreen/types';

interface NotesPanelProps {
  controller: EntityNotesController;
  isAdmin: boolean;
}

export const NotesPanel: React.FC<NotesPanelProps> = ({ controller: vm, isAdmin }) => (
  <>
    <S.TabSectionHeader>
      {!vm.isNoteEditorOpen && (
        <Button variant="secondary" size="sm" onClick={vm.openNoteEditor}>
          <RiAddLine size={14} />
          Nova Anotação
        </Button>
      )}
    </S.TabSectionHeader>

    {vm.isNoteEditorOpen && (
      <S.NoteEditorCard>
        <S.NoteEditorTitleRow>
          <Input
            value={vm.newNoteTitle}
            onChange={(e) => vm.setNewNoteTitle(e.target.value)}
            placeholder="Título da anotação *"
          />
        </S.NoteEditorTitleRow>
        <MarkdownEditor
          value={vm.newNoteText}
          onChange={vm.setNewNoteText}
          placeholder="Conteúdo em Markdown..."
        />
        <S.NoteEditorActions>
          <Button variant="ghost" size="sm" onClick={vm.closeNoteEditor}>
            <RiCloseLine size={14} />
            Cancelar
          </Button>
          <Button size="sm" onClick={() => void vm.handleAddNote()} disabled={vm.isAddingNote || !vm.newNoteTitle.trim() || !vm.newNoteText.trim()}>
            <RiAddLine size={14} />
            {vm.isAddingNote ? 'Adicionando...' : 'Adicionar'}
          </Button>
        </S.NoteEditorActions>
      </S.NoteEditorCard>
    )}

    {vm.notesLoading ? (
      <S.SpinnerWrap><Spinner /></S.SpinnerWrap>
    ) : vm.notes.length === 0 ? (
      <S.EmptyState>
        <S.EmptyIcon><RiFileTextLine /></S.EmptyIcon>
        <div>Nenhuma anotação ainda.</div>
      </S.EmptyState>
    ) : (
      <S.NoteList>
        {vm.notes.map((note) => {
          const isExpanded = vm.expandedNoteIds.has(note.id);
          return (
            <S.NoteCard key={note.id}>
              <S.NoteCardTop>
                <S.NoteCardClickArea onClick={() => vm.toggleNoteExpanded(note.id)}>
                  <S.NoteAvatar>
                    {note.createdByPhotoUrl
                      ? <S.AvatarImg src={note.createdByPhotoUrl} alt={note.createdByName} />
                      : (note.createdByName || 'U').charAt(0).toUpperCase()}
                  </S.NoteAvatar>
                  <S.NoteBody>
                    <S.NoteTitle>{note.title || '(sem título)'}</S.NoteTitle>
                    <S.NoteDate>
                      {note.createdByName} · {format(note.createdAt, "d 'de' MMM 'de' yyyy", { locale: ptBR })}
                    </S.NoteDate>
                  </S.NoteBody>
                  <S.NoteExpandIcon $expanded={isExpanded}>
                    <RiArrowDownSLine size={18} />
                  </S.NoteExpandIcon>
                </S.NoteCardClickArea>
                {isAdmin && (
                  <Button variant="ghost" size="sm" onClick={() => vm.requestDeleteNote(note)} title="Excluir anotação">
                    <RiDeleteBinLine size={13} />
                  </Button>
                )}
              </S.NoteCardTop>
              {isExpanded && (
                <>
                  <S.NoteDivider />
                  <S.NoteContent>
                    <MarkdownContent>{note.text}</MarkdownContent>
                  </S.NoteContent>
                </>
              )}
            </S.NoteCard>
          );
        })}
      </S.NoteList>
    )}

    <ConfirmModal
      isOpen={!!vm.noteToDelete}
      onConfirm={() => void vm.confirmDeleteNote()}
      onCancel={vm.cancelDeleteNote}
      title="Excluir Anotação"
      message="Tem certeza que deseja excluir esta anotação? Esta ação não pode ser desfeita."
      confirmLabel="Excluir"
      variant="danger"
    />
  </>
);
