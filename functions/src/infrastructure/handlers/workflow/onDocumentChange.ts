import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { publishChildRecordEvent } from './publishChildRecordEvent';

/** Publica `<prefixo do pai>_document.saved` e `<prefixo do pai>_document.deleted` — ver `publishChildRecordEvent`. */
export const onDocumentChange = onDocumentWritten(
  {
    document: 'tenants/{tenantId}/{parent}/{parentId}/documents/{childId}',
    region: 'southamerica-east1',
  },
  (event) => publishChildRecordEvent('document', event),
);
