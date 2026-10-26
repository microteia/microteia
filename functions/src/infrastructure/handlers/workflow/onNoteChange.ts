import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { publishChildRecordEvent } from './publishChildRecordEvent';

/** Publica `<prefixo do pai>_note.saved` e `<prefixo do pai>_note.deleted` — ver `publishChildRecordEvent`. */
export const onNoteChange = onDocumentWritten(
  {
    document: 'tenants/{tenantId}/{parent}/{parentId}/notes/{childId}',
    region: 'southamerica-east1',
  },
  (event) => publishChildRecordEvent('note', event),
);
