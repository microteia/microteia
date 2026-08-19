import { Icon } from '@microteia/ui';

const SOURCE_ID = 'microteia:financeiro';
const LIST_KEY = 'financeiro';
const GROUP = 'Financeiro';

const viewKey = (screen, id) => 'view-dyn:' + screen.id + ':' + id;

const screenOf = (ctx) => ctx.screenDefinitions.find((s) => (s.sourceId || s.id) === SOURCE_ID);
const textOf = (record, key) => (key && typeof record[key] === 'string' ? record[key] : '');

/**
 * A busca casa só o TÍTULO (a categoria). O subtítulo do lançamento é o TIPO ("Receita"/"Despesa"),
 * uma classificação que todo registro repete: casá-la devolveria metade do financeiro para quem
 * digitasse "rec". Quem inclui o subtítulo é Processos, onde ele é o NÚMERO do processo.
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
      const icon = <Icon name="moneyDollar" size={16} />;
      const items = [];
      if ('novo lancamento'.indexOf(q) !== -1 || 'novo lançamento'.indexOf(q) !== -1) {
        items.push({ id: 'financeiro:new', title: 'Novo lançamento', group: GROUP, icon, onSelect: () => { ctx.openTab('new-dyn:' + screen.id); ctx.close(); } });
      }
      if ('abrir financeiro'.indexOf(q) !== -1) {
        items.push({ id: 'financeiro:list', title: 'Abrir Financeiro', group: GROUP, icon, onSelect: () => { ctx.openTab(LIST_KEY); ctx.close(); } });
      }
      for (const r of recordsOf(ctx, screen)) {
        if (!matches(r, screen, q)) continue;
        items.push({
          id: 'financeiro:' + r.id,
          title: textOf(r, screen.titleFieldKey),
          subtitle: textOf(r, screen.subtitleFieldKey) || 'Lançamento',
          group: GROUP,
          icon,
          onSelect: () => { ctx.openTab(viewKey(screen, r.id)); ctx.close(); },
        });
      }
      return items.slice(0, 9);
    },
  });

  host.mentions.register({
    key: 'lancamento',
    label: 'Lançamento',
    description: 'Inserir link para um lançamento financeiro',
    icon: 'moneyDollar',
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
          subtitle: textOf(record, screen.subtitleFieldKey) || 'Lançamento',
          tabKey: viewKey(screen, record.id),
        }));
    },
  });
}
