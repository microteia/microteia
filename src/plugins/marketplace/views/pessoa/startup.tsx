import { Icon } from '@microteia/ui';

const SOURCE_ID = 'microteia:pessoa';
const GROUP = 'Pessoas';

const screenOf = (ctx) => ctx.screenDefinitions.find((s) => (s.sourceId || s.id) === SOURCE_ID);
const textOf = (record, key) => (key && typeof record[key] === 'string' ? record[key] : '');

/**
 * A busca casa só o TÍTULO — o nome. O subtítulo de Pessoa é o TIPO ("Pessoa Física"), uma
 * classificação que todo registro repete: casá-la devolveria o cadastro inteiro para quem digitasse
 * "fis". Quem inclui o subtítulo é Processos, onde ele é o NÚMERO do processo.
 */
const matches = (record, screen, q) => {
  if (!q) return true;
  return textOf(record, screen.titleFieldKey).toLowerCase().indexOf(q) !== -1;
};

const recordsOf = (ctx, screen) => {
  const collection = screen.dataCollection || screen.id;
  return ctx.records.filter((r) => r.collection === collection && textOf(r, screen.titleFieldKey));
};

export default function startup(host) {
  host.commands.register({
    group: GROUP,
    getItems(query, ctx) {
      const q = String(query || '').toLowerCase().trim();
      if (!q) return [];
      const screen = screenOf(ctx);
      if (!screen) return [];
      const icon = <Icon name="team" size={16} />;
      const items = [];
      if ('nova pessoa'.indexOf(q) !== -1) {
        items.push({ id: 'pessoa:new', title: 'Nova pessoa', group: GROUP, icon, onSelect: () => { ctx.openTab('new-dyn:' + screen.id); ctx.close(); } });
      }
      if ('abrir pessoas'.indexOf(q) !== -1) {
        items.push({ id: 'pessoa:list', title: 'Abrir Pessoas', group: GROUP, icon, onSelect: () => { ctx.openTab('dyn:' + screen.id); ctx.close(); } });
      }
      for (const r of recordsOf(ctx, screen)) {
        if (!matches(r, screen, q)) continue;
        items.push({
          id: 'pessoa:' + r.id,
          title: textOf(r, screen.titleFieldKey),
          subtitle: textOf(r, screen.subtitleFieldKey) || 'Pessoa',
          group: GROUP,
          icon,
          onSelect: () => { ctx.openTab('view-dyn:' + screen.id + ':' + r.id); ctx.close(); },
        });
      }
      return items.slice(0, 9);
    },
  });

  host.mentions.register({
    key: 'pessoa',
    label: 'Pessoa',
    description: 'Inserir link para uma pessoa',
    icon: 'team',
    search(query, ctx) {
      const screen = screenOf(ctx);
      if (!screen) return [];
      const q = String(query || '').toLowerCase().trim();
      return recordsOf(ctx, screen)
        .filter((r) => matches(r, screen, q))
        .slice(0, 20)
        .map((record) => ({
          id: record.id,
          title: textOf(record, screen.titleFieldKey),
          subtitle: textOf(record, screen.subtitleFieldKey) || 'Pessoa',
          tabKey: 'view-dyn:' + screen.id + ':' + record.id,
        }));
    },
  });
}
