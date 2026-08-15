import { useCallback, useEffect, useState } from 'react';
import { useNotification } from '../../../stores/useNotification';
import type { EntityNote, EntityNotesController, NotesPort } from './types';

import { useT } from '../i18n/useT';

interface UseEntityNotesParams {
  enabled: boolean;
  recordId: string | null;
  port: NotesPort;
}

export const useEntityNotes = ({ enabled, recordId, port }: UseEntityNotesParams): EntityNotesController => {
  const { notify } = useNotification();
  const t = useT('core.ui');

  const [notes, setNotes] = useState<EntityNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteText, setNewNoteText] = useState('');
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [isNoteEditorOpen, setIsNoteEditorOpen] = useState(false);
  const [expandedNoteIds, setExpandedNoteIds] = useState<Set<string>>(new Set());
  const [noteToDelete, setNoteToDelete] = useState<EntityNote | null>(null);

  useEffect(() => {
    if (!enabled || !recordId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carregamento inicial de anotações
    setNotesLoading(true);
    port.get(recordId)
      .then(setNotes)
      .finally(() => setNotesLoading(false));
  }, [enabled, recordId, port]);

  const openNoteEditor = useCallback(() => setIsNoteEditorOpen(true), []);
  const closeNoteEditor = useCallback(() => {
    setIsNoteEditorOpen(false);
    setNewNoteTitle('');
    setNewNoteText('');
  }, []);

  const toggleNoteExpanded = useCallback((id: string) => {
    setExpandedNoteIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleAddNote = useCallback(async () => {
    if (!newNoteTitle.trim() || !newNoteText.trim() || !recordId) return;
    setIsAddingNote(true);
    try {
      const note = await port.add(recordId, { title: newNoteTitle.trim(), text: newNoteText.trim() });
      setNotes((prev) => [note, ...prev]);
      setNewNoteTitle('');
      setNewNoteText('');
      setIsNoteEditorOpen(false);
      notify(t('note.added'), 'success');
    } catch {
      notify(t('note.add-failed'), 'error');
    } finally {
      setIsAddingNote(false);
    }
  }, [newNoteTitle, newNoteText, recordId, port, notify, t]);

  const requestDeleteNote = useCallback((note: EntityNote) => setNoteToDelete(note), []);
  const cancelDeleteNote = useCallback(() => setNoteToDelete(null), []);
  const confirmDeleteNote = useCallback(async () => {
    if (!noteToDelete || !recordId) return;
    try {
      await port.remove(recordId, noteToDelete.id);
      setNotes((prev) => prev.filter((n) => n.id !== noteToDelete.id));
      notify(t('note.deleted'), 'success');
    } catch {
      notify(t('note.delete-failed'), 'error');
    } finally {
      setNoteToDelete(null);
    }
  }, [noteToDelete, recordId, port, notify, t]);

  return {
    notes,
    notesLoading,
    newNoteTitle,
    setNewNoteTitle,
    newNoteText,
    setNewNoteText,
    isAddingNote,
    isNoteEditorOpen,
    openNoteEditor,
    closeNoteEditor,
    expandedNoteIds,
    toggleNoteExpanded,
    handleAddNote,
    noteToDelete,
    requestDeleteNote,
    confirmDeleteNote,
    cancelDeleteNote,
  };
};
