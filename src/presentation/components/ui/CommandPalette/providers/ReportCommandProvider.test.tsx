import { describe, it, expect, vi } from 'vitest';
import { ReportCommandProvider } from './ReportCommandProvider';
import type { CommandPaletteAppContext, CommandPaletteReport } from './ICommandPaletteProvider';

const reports: CommandPaletteReport[] = [
  {
    key: 'faturamento',
    title: 'Faturamento por sócio',
    covers: 'lancamentos',
    collections: ['lancamentos'],
  },
  {
    key: 'clientes-por-cidade',
    // Título vindo de EXTENSÃO: uma referência de mensagem, não o texto.
    title: '@com.acme.vendas/report.cidades',
    covers: 'clientes',
    collections: ['clientes', 'cidades'],
  },
  {
    key: 'desligado',
    title: 'Desligado',
    covers: 'lancamentos',
    collections: ['lancamentos'],
    enabled: false,
  },
];

const context = (granted: string[]): CommandPaletteAppContext => ({
  reports,
  can: (permission: string) => granted.includes(permission),
  openTab: vi.fn(),
  close: vi.fn(),
  label: (value: string | null | undefined) =>
    (value === '@com.acme.vendas/report.cidades' ? 'Clientes por cidade' : (value ?? '')),
} as unknown as CommandPaletteAppContext);

const titles = (query: string, granted: string[]): string[] =>
  ReportCommandProvider.getItems(query, context(granted)).map((item) => item.title);

describe('ReportCommandProvider', () => {
  it('não oferece nada sem busca — a paleta vazia não lista tudo', () => {
    expect(ReportCommandProvider.getItems('', context(['lancamentos.read']))).toEqual([]);
  });

  it('acha pelo nome que a pessoa LÊ', () => {
    expect(titles('sócio', ['lancamentos.read'])).toEqual(['Faturamento por sócio']);
  });

  it('acha o relatório de extensão pelo título RESOLVIDO, não pela referência', () => {
    // Casar a query contra `@com.acme.vendas/report.cidades` deixaria esse relatório inalcançável:
    // ninguém digita a chave.
    expect(titles('cidade', ['clientes.read', 'cidades.read']))
      .toEqual(['@com.acme.vendas/report.cidades']);
  });

  it('esconde o que esta pessoa não poderia executar', () => {
    // A mesma pergunta da lista e a mesma do servidor. Oferecer aqui o que a callable vai recusar
    // seria abrir uma porta fechada.
    expect(titles('cidade', ['clientes.read'])).toEqual([]);
  });

  it('esconde o relatório desligado', () => {
    expect(titles('desligado', ['lancamentos.read'])).toEqual([]);
  });

  it('abre a aba do relatório e fecha a paleta', () => {
    const ctx = context(['lancamentos.read']);
    ReportCommandProvider.getItems('sócio', ctx)[0].onSelect();

    expect(ctx.openTab).toHaveBeenCalledWith('rep:faturamento');
    expect(ctx.close).toHaveBeenCalled();
  });

  it('acha também pela chave, que é o que aparece num link', () => {
    expect(titles('faturamento', ['lancamentos.read'])).toEqual(['Faturamento por sócio']);
  });
});
