// Runs in the same QuickJS sandbox a Script runs in — no imports, and only the globals the sandbox
// provides. Server-side, once per office, and never in the browser.
//
// It NEVER writes a collection name by hand. `input.collections` maps the template key declared in the
// package to the collection actually installed here: the key is CLAIMED on install and gets a suffix
// when the name is already taken in the destination office. Screens and flows are rewritten during
// materialisation, but a migration's code is opaque text that nobody would rewrite — so a hardcoded
// name works in the author's office and fails silently in the customer's.
async function main() {
  const table = input.collections['patchNote'];

  const pending = await query({
    table,
    where: [{ path: 'code', op: 'eq', value: null }],
    limit: 200,
  });

  for (const row of pending.rows) {
    await upsert({
      table,
      data: { id: row.id, code: fn.upper(fn.trim(fn.coalesce(row.title, ''))) },
    });
  }

  // `remaining` is what makes this run again. Without it a migration ends after the first round, and a
  // collection larger than one batch would be left half done — with nothing saying so.
  return { changed: pending.rows.length, remaining: pending.rows.length > 0 };
}

main()
