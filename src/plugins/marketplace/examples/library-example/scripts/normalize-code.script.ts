// Runs in the QuickJS sandbox on the server, never in the browser. `input` and `log` are globals the
// sandbox provides, and nothing else is reachable.
//
// The import below exists for `tsc` and your editor. The sandbox resolves no module, so the compiler
// MERGES the files listed in `sourceFile` into one text — the rule first, this file last — and drops
// the import and the `export`s on the way. Whatever can be wrong goes in the rule file, with a test
// beside it; this file only wires the input to it.
//
// This is what `manifest.exports` makes public. Another extension points a step at it by name —
// `com.microteia.library-example/normalize-code` — and never by the id it happens to get here.
import { normalizeCode } from './normalizeCode';

async function main() {
  const result = normalizeCode(input.code);
  if (result.code === null) log('normalize-code: nothing given');
  return result;
}

main()
