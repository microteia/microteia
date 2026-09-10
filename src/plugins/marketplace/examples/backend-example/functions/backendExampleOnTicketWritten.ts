import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions';
import { forInstalledExtension } from 'microteia-functions/office';

/**
 * A FIRESTORE TRIGGER — and it is born with the installation gate, which is not decoration.
 *
 * The Cloud Function belongs to the PROJECT; installing the extension is the ORGANIZATION's act.
 * Without the gate this fires for organizations that never installed the extension, and for the one
 * that uninstalled it while another still has it — a case where the function cannot even be removed,
 * because somebody else still needs it. The gate is what makes the withdrawal complete, and it also
 * covers the minutes between an uninstall and the next `microteia provision --prune`.
 *
 * It fails CLOSED: an event whose path carries no `{tenantId}` is skipped and logged, never guessed.
 *
 * The `{tenantId}` in the path is not optional styling. Every document of an organization lives under
 * `tenants/{tenantId}/`, and that segment is what the gate reads to know which organization to ask
 * about.
 */
const REGION = 'southamerica-east1';

export const backendExampleOnTicketWritten = onDocumentWritten(
  { document: 'tenants/{tenantId}/backendTicket/{id}', region: REGION },
  forInstalledExtension('com.microteia.backend-example', async (event) => {
    const after = event.data?.after?.data();
    if (after === undefined) return;
    logger.info('backend-example: ticket written', {
      tenantId: event.params.tenantId,
      ticketId: event.params.id,
    });
  }),
);
