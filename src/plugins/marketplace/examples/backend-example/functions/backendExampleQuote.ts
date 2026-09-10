import { onCall } from 'firebase-functions/v2/https';
import { defineString } from 'firebase-functions/params';
import { requireInstalledExtension } from 'microteia-functions/office';

/**
 * A CALLABLE — the shape a screen reaches directly, with `useCallable('backendExampleQuote')`.
 *
 * `requireInstalledExtension` makes the three refusals this function owes before it looks at the
 * payload: the caller signed in, the caller belongs to that organization, and this extension is
 * installed and active there. It returns the caller's uid.
 *
 * The middle refusal is the one that is not obvious, and it is why "an orphan callable just sits
 * there" is false. The deploy grants every callable public invocation, so what stands between this
 * function and the internet is only the Firebase token check: it answers ANY signed-in user of the
 * project, from any organization, installed or not. And the organization arrives IN THE PAYLOAD,
 * because `useCallable` sends only what the screen passed — so without the check, a user of one
 * organization can point this at another.
 *
 * It throws rather than returning a boolean, deliberately: a `false` invites being ignored, and the
 * missing `if` leaves no symptom at all.
 */

/**
 * A setting the office fills in, not a secret compiled into anything. The NAME is what goes in
 * `manifest.backend.parameters`; the value is written per installation, and never shared between them.
 */
const rate = defineString('BACKEND_EXAMPLE_RATE');

const REGION = 'southamerica-east1';

export const backendExampleQuote = onCall({ region: REGION, cors: true }, async (request) => {
  const { tenantId, amount } = (request.data ?? {}) as { tenantId?: string; amount?: number };
  const uid = await requireInstalledExtension(
    'com.microteia.backend-example',
    String(tenantId ?? ''),
    request,
  );

  const factor = Number(rate.value() || '1');
  return { quotedBy: uid, amount: Number(amount ?? 0) * factor };
});
