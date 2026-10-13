import { createContext, useContext } from 'react';
import type { ComponentType } from 'react';
import type { EntityRecord } from '../domain/entities';

/** O que um diálogo de registro recebe: o registro, onde ele vive, e como se fechar. */
export interface RecordDialogProps {
  record: EntityRecord;
  /** Coleção onde o registro vive. */
  collection: string;
  screenKey: string;
  onClose: () => void;
}

export type RecordDialogComponent = ComponentType<RecordDialogProps>;

export interface OpenRecordDialog {
  component: RecordDialogComponent;
  props: Omit<RecordDialogProps, 'onClose'>;
}

export interface RecordDialogState {
  dialog: OpenRecordDialog | null;
  open: (dialog: OpenRecordDialog) => void;
  close: () => void;
}

export const RecordDialogContext = createContext<RecordDialogState | null>(null);

const INERT: RecordDialogState = { dialog: null, open: () => undefined, close: () => undefined };

/**
 * Tolerante fora do provedor, como `useT`: a listagem e o detalhe também são montados fora do
 * workspace — num teste, na pré-visualização de uma extensão —, e ali não há onde desenhar o
 * diálogo. A ação que pede um diálogo simplesmente não abre nada, em vez de derrubar a tela.
 */
export const useRecordDialog = (): RecordDialogState => useContext(RecordDialogContext) ?? INERT;
