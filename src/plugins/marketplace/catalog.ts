import type { MarketplacePlugin } from '../../domain/entities/MarketplacePlugin';
import { nav, widgetPage } from '../contributionBuilders';
import { vendasPlugin } from './vendas';
import { kanbanCasesPlugin } from './kanbanCases';
import { brasilPlugin } from './brasil';
import { contratoPlugin } from './contrato';
import { financeiroPlugin } from './financeiro';
import { pessoaPlugin } from './pessoa';
import { prazoPlugin } from './prazo';
import { processoPlugin } from './processo';
import { noticiaPlugin } from './noticia';
import { pushPlugin } from './push';
import { dashboardPlugin } from './dashboard';
import { calendarPlugin } from './calendar';
import { localePtBrPlugin } from './localePtBr';
import { THEME_MARKETPLACE_PLUGINS } from './themes';

/**
 * Extensões de exemplo, mantidas como MOLDE de autoria e como fixtures dos testes da máquina de
 * instalação — fora do catálogo embutido de propósito (ver `MARKETPLACE_CATALOG`, que traz só as de
 * primeira parte). Cada exemplo prova um mecanismo:
 * - `boasVindasPlugin` — só um workflow, materializado no tenant (o motor já o executa).
 * - `guiaPlugin` — só UI (item de menu + página em Widget DSL), carregada ao vivo pelo host; nada gravado.
 */
export const boasVindasPlugin: MarketplacePlugin =
  {
    manifest: {
      id: 'com.microteia.boas-vindas',
      version: '1.0.0',
      kernel: '^1.0.0',
      name: 'Boas-vindas ao Cliente',
      description: 'Registra na auditoria toda vez que uma nova pessoa é cadastrada.',
      publisher: { name: 'Microteia' },
      permissions: ['workflow:run'],
    },
    summary:
      'Ao cadastrar uma nova pessoa, registra um evento na Auditoria dando as boas-vindas. Um exemplo simples de automação instalável.',
    overview: {
      type: 'stack',
      gap: 'lg',
      children: [
        {
          type: 'markdown',
          content:
            'A extensão **Boas-vindas ao Cliente** adiciona uma automação que reage ao cadastro de cada nova pessoa no escritório.\n\nÉ um exemplo de como uma extensão pode instalar uma automação completa com um clique — e removê-la sem deixar rastro.',
        },
        {
          type: 'grid',
          columns: 2,
          children: [
            { type: 'metric', label: 'Automações', value: '1' },
            { type: 'metric', label: 'Gatilho', value: 'Nova pessoa' },
          ],
        },
        { type: 'divider' },
        {
          type: 'keyValue',
          items: [
            { label: 'Publicado por', value: 'Microteia' },
            { label: 'Evento', value: 'Pessoa cadastrada' },
            { label: 'Efeito', value: 'Registro na Auditoria' },
          ],
        },
        {
          type: 'banner',
          message: 'Esta é uma extensão de exemplo, segura para instalar e remover a qualquer momento.',
          variant: 'info',
        },
      ],
    },
    workflows: [
      {
        templateId: 'wf-boas-vindas',
        name: 'Boas-vindas ao Cliente',
        description: 'Registra na auditoria quando uma nova pessoa é criada.',
        eventName: 'person.saved',
        version: 1,
        condition: {
          kind: 'FieldComparison',
          // fieldPath é resolvido contra o CONTEXTO inteiro — caminho absoluto (event.payload.*).
          fieldPath: 'event.payload.changeType',
          operator: '==',
          value: 'created',
          valueType: 'literal',
        },
        steps: [
          {
            id: 'audit',
            stepDefinitionId: 'register-audit',
            type: 'Action',
            order: 0,
            enabled: true,
            configuration: {
              title: { kind: 'Literal', value: 'Novo cliente cadastrado' },
              message: {
                kind: 'Expression',
                expression: 'concat("Bem-vindo(a), ", event.name, "!")',
              },
              severity: { kind: 'Literal', value: 'LOW' },
              entity: { kind: 'Literal', value: 'person' },
              // Mapping 'Event' é resolvido contra event.payload — caminho RELATIVO ao payload.
              entityId: { kind: 'Event', path: 'id' },
            },
          },
        ],
      },
    ],
  };

export const guiaPlugin: MarketplacePlugin =
  {
    manifest: {
      id: 'com.microteia.guia',
      version: '1.0.0',
      kernel: '^1.0.0',
      name: 'Guia do Escritório',
      description: 'Adiciona uma página de guia rápido ao menu do escritório.',
      publisher: { name: 'Microteia' },
      dependencies: { 'core.ui': '^1.0.0' },
      contributes: [
        nav({ key: 'guia', label: 'Guia', icon: 'bookSimple', order: 106 }),
        widgetPage(
          { key: 'guia', title: 'Guia do Escritório', icon: 'bookSimple' },
          {
            type: 'stack',
            gap: 'lg',
            children: [
              { type: 'heading', text: 'Guia do Escritório' },
              {
                type: 'markdown',
                content:
                  'Esta página foi **adicionada por uma extensão** — não faz parte do sistema base. Ela demonstra que um plugin pode trazer uma tela própria, descrita de forma declarativa e renderizada com segurança pela plataforma Microteia.',
              },
              {
                type: 'grid',
                columns: 3,
                children: [
                  { type: 'metric', label: 'Cadastre', value: 'Pessoas' },
                  { type: 'metric', label: 'Organize', value: 'Processos' },
                  { type: 'metric', label: 'Controle', value: 'Prazos' },
                ],
              },
              { type: 'divider' },
              {
                type: 'keyValue',
                items: [
                  { label: 'Origem', value: 'Extensão Guia do Escritório' },
                  { label: 'Tipo de tela', value: 'Declarativa (Widget DSL)' },
                  { label: 'Código no navegador', value: 'Nenhum' },
                ],
              },
              {
                type: 'banner',
                message: 'Desative ou remova a extensão a qualquer momento — esta página some junto.',
                variant: 'info',
              },
            ],
          },
        ),
      ],
    },
    summary:
      'Adiciona um item "Guia" ao menu, com uma página de introdução ao escritório. Um exemplo de extensão que traz a própria tela, sem código no navegador.',
    overview: {
      type: 'stack',
      gap: 'md',
      children: [
        {
          type: 'markdown',
          content:
            'A extensão **Guia do Escritório** adiciona uma página ao menu lateral. É um exemplo de como uma extensão pode entregar **interface própria** — descrita como dado e renderizada pelo Microteia, sem executar código de terceiro no navegador.',
        },
        {
          type: 'banner',
          message: 'Após instalar, procure o item "Guia" no menu à esquerda.',
          variant: 'info',
        },
      ],
    },
    workflows: [],
  };

export { vendasPlugin, kanbanCasesPlugin, brasilPlugin, pessoaPlugin, contratoPlugin, processoPlugin, financeiroPlugin, prazoPlugin, pushPlugin, noticiaPlugin, dashboardPlugin, calendarPlugin, localePtBrPlugin };

/**
 * Catálogo do Marketplace EMBUTIDO: extensões de PRIMEIRA PARTE que viajam no bundle da aplicação.
 * Aparecem em Extensões com o selo "Do sistema", instalam com um clique e — por virem do próprio
 * código da aplicação — dispensam o gesto de revisão de código (`hasTrustedProvenance`), então a
 * tela em código executa direto. É o caminho curto para desenvolver e testar uma extensão nossa:
 * editar o `.ts`, recarregar, "Atualizar" na linha da extensão.
 *
 * O botão "Atualizar" aparece sempre que o pacote embutido difere do instalado, e não só quando a
 * versão sobe — durante o desenvolvimento a versão costuma ficar parada enquanto o código muda.
 *
 * O mesmo pacote também é distribuível como `.json` (`extension-templates/`, gerado por
 * `npm run build:extensions`), para importar em escritórios que não rodam este bundle.
 */
export const MARKETPLACE_CATALOG: MarketplacePlugin[] = [
  localePtBrPlugin,
  brasilPlugin,
  dashboardPlugin,
  calendarPlugin,
  pessoaPlugin,
  contratoPlugin,
  processoPlugin,
  prazoPlugin,
  pushPlugin,
  financeiroPlugin,
  noticiaPlugin,
  kanbanCasesPlugin,
  ...THEME_MARKETPLACE_PLUGINS,
];
