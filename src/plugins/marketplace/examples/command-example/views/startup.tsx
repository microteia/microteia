import { Icon } from '@microteia/ui';

/**
 * `startup` runs when the extension LOADS, and returns its own teardown. It is the one place an
 * extension registers something at runtime rather than declaring it in the manifest — and for two
 * surfaces it is the ONLY place, because neither can be expressed as data:
 *
 * - the command palette, which has to SEARCH as the person types;
 * - the `@` mention in the markdown editor, same reason.
 *
 * Everything registered here is scoped to this plugin and released when it unloads, so the teardown
 * below is a courtesy rather than a requirement — but returning it is the habit worth keeping, because
 * anything you subscribe to yourself is not scoped for you.
 *
 * There are no hooks in this file. `startup` is not a component: what a component would get from
 * `useT` arrives in the CONTEXT instead, as `ctx.t`.
 */

const SOURCE_ID = 'microteia:command-example:note';
const NAMESPACE = 'com.microteia.command-example';
const GUIDE_TAB = 'command-example-guide';

/** A reference into this extension's own catalog, for whoever renders the label to resolve. */
const message = (key) => '@' + NAMESPACE + '/' + key;

const screenOf = (ctx) => ctx.screenDefinitions.find((s) => (s.sourceId || s.id) === SOURCE_ID);

const textOf = (record, key) => (key && typeof record[key] === 'string' ? record[key] : '');

const recordsOf = (ctx, screen) => {
  const collection = screen.dataCollection || screen.id;
  return ctx.records.filter((r) => r.collection === collection);
};

export default function startup(host) {
  host.commands.register({
    group: message('command.group'),
    /**
     * The query is compared against the TRANSLATED title, and that is the whole point of `ctx.t` being
     * here: matching a hardcoded phrase would leave the command unreachable for anyone typing what
     * they actually read on screen.
     *
     * An empty query returns nothing on purpose — the palette opens on every keystroke, and a
     * provider that answered "everything" would bury whatever the person was looking for.
     */
    getItems(query, ctx) {
      const q = String(query || '').toLowerCase().trim();
      if (!q) return [];

      const screen = screenOf(ctx);
      const icon = <Icon name="keyboard" size={16} />;
      const group = message('command.group');
      const items = [];

      const guide = ctx.t(NAMESPACE + '/command.guide');
      if (guide.toLowerCase().indexOf(q) !== -1) {
        items.push({
          id: 'command-example:guide',
          title: guide,
          group,
          icon,
          onSelect: () => { ctx.openTab(GUIDE_TAB); ctx.close(); },
        });
      }

      if (!screen) return items;
      for (const record of recordsOf(ctx, screen)) {
        const title = textOf(record, 'title');
        if (!title || title.toLowerCase().indexOf(q) === -1) continue;
        items.push({
          id: 'command-example:' + record.id,
          title,
          subtitle: textOf(record, 'note'),
          group,
          icon,
          // `view-dyn:<screen>:<record>` is the detail tab of a record on a declared screen. The
          // context offers `openTab` and nothing narrower: a palette item is a tab to open, and the
          // prefix is the whole addressing scheme.
          onSelect: () => { ctx.openTab('view-dyn:' + screen.id + ':' + record.id); ctx.close(); },
        });
      }

      return items.slice(0, 9);
    },
  });

  host.mentions.register({
    // The trigger typed after `@`. It is an IDENTIFIER and not a label: it stays stable across
    // languages, the same way a field key does. Translating it would break every mention already
    // written the moment somebody switched language.
    key: 'note',
    label: message('mention.label'),
    description: message('mention.description'),
    icon: 'keyboard',
    search(query, ctx) {
      const screen = screenOf(ctx);
      if (!screen) return [];
      const q = String(query || '').toLowerCase().trim();
      return recordsOf(ctx, screen)
        .filter((r) => textOf(r, 'title') && textOf(r, 'title').toLowerCase().indexOf(q) !== -1)
        .slice(0, 20)
        .map((r) => ({
          id: r.id,
          title: textOf(r, 'title'),
          subtitle: textOf(r, 'note'),
          tabKey: 'view-dyn:' + screen.id + ':' + r.id,
        }));
    },
  });
}
