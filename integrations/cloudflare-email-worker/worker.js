/**
 * Microteia — reference Cloudflare Email Worker for forwarded e-mail.
 *
 * Every message sent to a mailbox address of your domain is POSTed, raw and signed, to the `mailInbound`
 * function of a Microteia installation. Setup, step by step: https://doc.microteia.com/#/forwarded-email
 *
 * Configuration (Worker → Settings → Variables and secrets), one pair per installation:
 *   <NAME>_URL     https://<region>-<projectId>.cloudfunctions.net/mailInbound
 *   <NAME>_SECRET  the MAIL_INBOUND_SECRET of that installation (store it as a secret)
 *   FALLBACK_TO    optional: where to forward messages that are not mailbox addresses
 *
 * Routing. An installation with MAIL_INBOUND_SUFFIX=<suffix> hands out <code>_<suffix>@<domain>, and the
 * Worker delivers those straight to the pair named after the suffix in upper case: MAIL_INBOUND_SUFFIX=curatino
 * → CURATINO_URL + CURATINO_SECRET. One call per message, however many installations share the domain. A
 * suffix with no pair is rejected. An address WITHOUT a suffix (installations that have none, and mailboxes
 * connected before one was set) is tried on each pair in name order until one knows it: an installation
 * answers `unknown-recipient` for codes that are not its own, without reading the message.
 *
 * The contract it follows — headers, signature, answers, address format — is checked against the function
 * itself by scripts/cloudflareEmailWorker.test.ts in the Microteia repository.
 */

/** A mailbox address: 24 lowercase letters and digits, optionally _<suffix>, optionally followed by +tag. */
const MAILBOX_CODE = /^[a-z0-9]{24}$/;
const MAILBOX_SUFFIX = /^[a-z0-9]{1,32}$/;

const encoder = new TextEncoder();

const hex = (buffer) => [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('');

/** HMAC-SHA256 of "<timestamp>.<recipient>." followed by the raw message, keyed with the installation secret. */
async function sign(secret, timestamp, recipient, raw) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const prefix = encoder.encode(`${timestamp}.${recipient}.`);
  const data = new Uint8Array(prefix.length + raw.length);
  data.set(prefix);
  data.set(raw, prefix.length);
  return hex(await crypto.subtle.sign('HMAC', key, data));
}

function installationsOf(env) {
  return Object.keys(env)
    .filter((key) => key.endsWith('_URL'))
    .sort()
    .map((key) => {
      const name = key.slice(0, -'_URL'.length);
      return { name, url: env[key], secret: env[`${name}_SECRET`] };
    })
    .filter((installation) => installation.url && installation.secret);
}

async function deliver(installation, recipient, raw) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  return fetch(installation.url, {
    method: 'POST',
    headers: {
      'content-type': 'message/rfc822',
      'x-microteia-recipient': recipient,
      'x-microteia-timestamp': timestamp,
      'x-microteia-signature': await sign(installation.secret, timestamp, recipient, raw),
    },
    body: raw,
  });
}

/** The code and the installation suffix of a mailbox address, or null when it is not one. */
function mailboxAddressOf(recipient) {
  const [code, suffix, ...rest] = recipient.split('@')[0].split('+')[0].split('_');
  if (rest.length > 0 || !MAILBOX_CODE.test(code)) return null;
  if (suffix !== undefined && !MAILBOX_SUFFIX.test(suffix)) return null;
  return { code, suffix: suffix ?? null };
}

export default {
  async email(message, env) {
    const recipient = message.to.toLowerCase();
    const address = mailboxAddressOf(recipient);

    // Not a mailbox address: keep whatever the catch-all did before this Worker.
    if (!address) {
      if (env.FALLBACK_TO) return message.forward(env.FALLBACK_TO);
      return message.setReject('Unknown address');
    }

    const installations = installationsOf(env);
    let candidates = installations;
    if (address.suffix) {
      const name = address.suffix.toUpperCase();
      candidates = installations.filter((installation) => installation.name === name);
      if (candidates.length === 0) {
        console.log(`no ${name}_URL and ${name}_SECRET for the suffix "${address.suffix}"`);
        return message.setReject('Unknown address');
      }
    }

    // The raw stream can be read only once, and every installation needs the same bytes.
    const raw = new Uint8Array(await new Response(message.raw).arrayBuffer());
    let failed = false;
    for (const installation of candidates) {
      const response = await deliver(installation, recipient, raw);
      if (response.status === 413) return message.setReject('Message too large');
      if (response.status !== 202) {
        // 404: the function is not deployed there, or forwarding is not configured. 401: the secret differs.
        console.log(`${installation.name}: ${response.status} ${(await response.text()).slice(0, 200)}`);
        if (response.status >= 500) failed = true;
        continue;
      }
      const { outcome } = await response.json();
      console.log(`${installation.name}: ${outcome}`);
      if (outcome !== 'unknown-recipient') return;
    }
    // A server error is worth a retry by the sender; an address nobody knows is not.
    if (failed) throw new Error('mailInbound failed; see the log lines above');
    message.setReject('Unknown address');
  },
};
