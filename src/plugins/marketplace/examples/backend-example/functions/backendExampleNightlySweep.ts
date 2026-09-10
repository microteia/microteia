import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions';
import { forEachInstalledOffice } from 'microteia-functions/office';

/**
 * A SCHEDULED RUN — the shape whose event carries no organization at all.
 *
 * A schedule, a Pub/Sub message, an HTTP request and a Storage event have no `{tenantId}` in their
 * path, so `forInstalledExtension` has nobody to ask about and fails closed — which would leave the
 * function inert even while the extension IS installed. Without any guard it goes the other way and
 * acts on the whole project, including organizations that never installed the extension.
 *
 * `forEachInstalledOffice` is the answer for exactly these: it runs the handler once per organization
 * that has the extension, and returns how many. One organization failing does not take the others'
 * turn — every installed one runs, and the function then fails naming those that did not. A bad record
 * in one place cannot silently suspend the routine everywhere else, and a failure cannot pass
 * unnoticed either.
 */
const REGION = 'southamerica-east1';

export const backendExampleNightlySweep = onSchedule(
  { schedule: 'every day 03:00', region: REGION },
  async () => {
    const swept = await forEachInstalledOffice(
      'com.microteia.backend-example',
      async (tenantId) => {
        logger.info('backend-example: nightly sweep', { tenantId });
      },
    );
    logger.info('backend-example: sweep finished', { organizations: swept });
  },
);
