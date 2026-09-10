// Runs in the QuickJS sandbox on the server, never in the browser. There are no imports here on
// purpose: `input`, `fn` and `log` are globals the sandbox provides, and nothing else is reachable.
//
// This is what `manifest.exports` makes public. Another extension points a step at it by name —
// `com.microteia.library-example/normalize-code` — and never by the id it happens to get here.
async function main() {
  if (fn.isEmpty(input.code)) {
    log('normalize-code: nothing given');
    return { code: null, changed: false };
  }

  const original = String(input.code);
  const code = fn.upper(fn.trim(original)).split(' ').join('-');

  return { code, changed: code !== original };
}

main()
