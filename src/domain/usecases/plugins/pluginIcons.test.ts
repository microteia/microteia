import { describe, expect, it } from 'vitest';
import type { MarketplacePlugin } from '../../entities/MarketplacePlugin';
import { UI_NAV_POINT, UI_PAGE_POINT } from '../../schema/ui/uiExtensionPoints';
import { packageIconIssues } from './pluginIcons';
import { packageIssues } from './pluginReferences';

const base = (overrides: Partial<MarketplacePlugin>): MarketplacePlugin => ({
  summary: 'x',
  manifest: { id: 'com.acme.x', version: '1.0.0', kernel: '^2.0.0', name: 'X' },
  workflows: [],
  ...overrides,
});

const nomes = (pkg: MarketplacePlugin): string[] =>
  packageIconIssues(pkg).map((issue) => `${issue.messageParams?.where}=${issue.messageParams?.icon}`);

describe('o ícone inventado é recusado no portão do pacote', () => {
  it('aceita o pacote que só escreve chaves do catálogo', () => {
    expect(packageIconIssues(base({
      manifest: { id: 'com.acme.x', version: '1.0.0', kernel: '^2.0.0', name: 'X', icon: 'calendar' },
      actions: [{ templateId: 'a', key: 'a', title: 't', icon: 'check', workflowId: 'w', order: 0, enabled: true, danger: false }],
    }))).toEqual([]);
  });

  /**
   * O caso que motivou a checagem: `refresh` nunca existiu, e um exemplo de primeira parte viajou com
   * ele. O kernel desenha o marcador genérico para o que não reconhece — o defeito não falha em lugar
   * nenhum, só aparece na tela de quem instalou.
   */
  it('recusa a ação com ícone que não existe, dizendo qual e onde', () => {
    expect(nomes(base({
      actions: [{ templateId: 'a', key: 'a', title: 't', icon: 'refresh', workflowId: 'w', order: 0, enabled: true, danger: false }],
    }))).toEqual(['actions[0].icon=refresh']);
  });

  it('alcança o manifest, a contribuição, a tela, o campo do cartão e a view', () => {
    expect(nomes(base({
      manifest: {
        id: 'com.acme.x',
        version: '1.0.0',
        kernel: '^2.0.0',
        name: 'X',
        icon: 'inventado',
        contributes: [
          { point: UI_NAV_POINT, id: 'n', apiVersion: '1.0.0', metadata: { key: 'n', label: 'l', icon: 'tambem-nao', order: 1 } },
        ],
      },
      screens: [{
        key: 's',
        titleSingular: 'S',
        titlePlural: 'S',
        icon: 'nem-esse',
        titleFieldKey: 'name',
        fields: [{ key: 'name', label: 'N', type: 'text', order: 0, required: false, listIcon: 'muito-menos' }],
      }],
      views: [{ key: 'v', title: 'V', icon: 'nada', source: '' }],
    }))).toEqual([
      'manifest.icon=inventado',
      'contributes[0].metadata.icon=tambem-nao',
      'screens[0].icon=nem-esse',
      'screens[0].fields.name.listIcon=muito-menos',
      'views[0].icon=nada',
    ]);
  });

  /**
   * O `icon` de um ponto de OUTRA extensão é vocabulário dela. Recusá-lo aqui seria o núcleo
   * legislando sobre um nome que não é dele.
   */
  it('não opina sobre o metadata de um ponto que não é do núcleo', () => {
    expect(packageIconIssues(base({
      manifest: {
        id: 'com.acme.x',
        version: '1.0.0',
        kernel: '^2.0.0',
        name: 'X',
        contributes: [
          { point: 'com.outra.ponto', id: 'c', apiVersion: '1.0.0', metadata: { icon: 'o-que-ela-quiser' } },
        ],
      },
    }))).toEqual([]);
  });

  it('chega pela porta única, junto do tamanho e das migrações', () => {
    const pkg = base({
      manifest: {
        id: 'com.acme.x',
        version: '1.0.0',
        kernel: '^2.0.0',
        name: 'X',
        contributes: [
          { point: UI_PAGE_POINT, id: 'p', apiVersion: '1.0.0', metadata: { key: 'p', title: 't', icon: 'refresh' } },
        ],
      },
    });
    expect(packageIssues(pkg)).toEqual(packageIconIssues(pkg));
    expect(packageIssues(pkg)).toHaveLength(1);
  });
});
