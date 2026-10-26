import type React from 'react';
import type { DynamicSelectOption } from '../../components/ui/DynamicSelect';

// ─── Formas comuns (PersonNote/CustomRecordNote e PersonDocument/CustomRecordDocument satisfazem) ──

export interface EntityNote {
  id: string;
  title: string;
  text: string;
  createdByName: string;
  createdByPhotoUrl?: string;
  createdAt: Date;
}

export interface EntityDocument {
  id: string;
  name: string;
  type?: string;
  description?: string;
  url: string;
  storagePath: string;
  createdByName: string;
  createdByPhotoUrl?: string;
  createdAt: Date;
  portalShared?: boolean;
  /** O SHA-256 do arquivo, calculado pelo servidor. Ausente enquanto não foi calculado. */
  sha256?: string;
}

// ─── Ports: o adapter embrulha os use cases da entidade (tenant/usuário/screenKey ficam presos no closure) ──

export interface NotesPort {
  get: (recordId: string) => Promise<EntityNote[]>;
  add: (recordId: string, input: { title: string; text: string }) => Promise<EntityNote>;
  remove: (recordId: string, noteId: string) => Promise<void>;
}

export interface DocumentsPort {
  get: (recordId: string) => Promise<EntityDocument[]>;
  upload: (recordId: string, file: File) => Promise<{ url: string; storagePath: string }>;
  add: (
    recordId: string,
    input: { name: string; type?: string; url: string; storagePath: string },
  ) => Promise<EntityDocument>;
  remove: (recordId: string, doc: EntityDocument) => Promise<void>;
  /** Ausente onde não há portal — o anexo de uma tela de extensão, por exemplo. */
  setPortalShared?: (recordId: string, doc: EntityDocument, shared: boolean) => Promise<void>;
}

/**
 * O que um campo `file` precisa para enviar. Um objeto só, e não `collection` + `recordId`, porque o
 * id de um registro novo é cunhado no momento da escolha do arquivo — o formulário não deve saber
 * disso, e a coleção fica presa no closure como nos outros ports.
 */
export interface FieldFileUpload {
  /** Devolve a URL de download já gravável no campo. */
  upload: (fieldKey: string, file: File) => Promise<string>;
}

// ─── Retorno dos hooks (consumido pelos painéis) ──────────────────────────────

export interface EntityNotesController {
  notes: EntityNote[];
  notesLoading: boolean;
  newNoteTitle: string;
  setNewNoteTitle: (v: string) => void;
  newNoteText: string;
  setNewNoteText: (v: string) => void;
  isAddingNote: boolean;
  isNoteEditorOpen: boolean;
  openNoteEditor: () => void;
  closeNoteEditor: () => void;
  expandedNoteIds: Set<string>;
  toggleNoteExpanded: (id: string) => void;
  handleAddNote: () => Promise<void>;
  noteToDelete: EntityNote | null;
  requestDeleteNote: (note: EntityNote) => void;
  confirmDeleteNote: () => Promise<void>;
  cancelDeleteNote: () => void;
}

/**
 * Um arquivo escolhido e ainda não enviado.
 *
 * O `id` é cunhado no cliente porque o nome não identifica: escolher dois arquivos homônimos de
 * pastas diferentes é comum, e é por esse id que a linha sabe de qual tipo o usuário está falando.
 */
export interface PendingDocumentUpload {
  id: string;
  file: File;
  type: string;
  status: 'pending' | 'uploading' | 'failed';
}

export interface EntityDocumentsController {
  documents: EntityDocument[];
  docsLoading: boolean;
  isUploadingDoc: boolean;
  pendingUploads: PendingDocumentUpload[];
  setPendingUploadType: (id: string, type: string) => void;
  removePendingUpload: (id: string) => void;
  handleSelectFiles: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleCancelPendingUpload: () => void;
  handleConfirmUpload: () => Promise<void>;
  docToDelete: EntityDocument | null;
  requestDeleteDoc: (doc: EntityDocument) => void;
  confirmDeleteDoc: () => Promise<void>;
  cancelDeleteDoc: () => void;
  documentTypeOptions: DynamicSelectOption[];
  documentTypeDynamicOptions: DynamicSelectOption[];
  handleAddDocumentType: (name: string) => Promise<void>;
  handleDeleteDocumentType: (key: string) => Promise<void>;
  /** A tela expõe documentos no portal, e quem vê pode editar o registro. */
  canShareInPortal: boolean;
  togglePortalShared: (doc: EntityDocument) => Promise<void>;
}
