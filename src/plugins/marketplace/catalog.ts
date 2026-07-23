import type { MarketplacePlugin } from '../../domain/entities/MarketplacePlugin';
import { nav, widgetPage } from '../contributionBuilders';
import { vendasPlugin } from './vendas';

/**
 * Catálogo do Marketplace embutido. Dois exemplos, cada um provando um mecanismo de instalação:
 * - "Boas-vindas ao Cliente" — só um workflow, materializado no tenant (o motor já o executa).
 * - "Guia do Escritório" — só UI (item de menu + página em Widget DSL): ao instalar, o host de
 *   tenant carrega suas contribuições e o menu/página aparecem ao vivo; nada é gravado.
 *
 * Hoje o catálogo é código embutido; publicá-los leva ao registro global `plugin_registry`.
 */
export const MARKETPLACE_CATALOG: MarketplacePlugin[] = [
  {
    manifest: {
      id: 'com.curatino.boas-vindas',
      version: '1.0.0',
      kernel: '^1.0.0',
      name: 'Boas-vindas ao Cliente',
      description: 'Registra na auditoria toda vez que uma nova pessoa é cadastrada.',
      publisher: { name: 'Curatino' },
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
            { label: 'Publicado por', value: 'Curatino' },
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
  },
  {
    manifest: {
      id: 'com.curatino.guia',
      version: '1.0.0',
      kernel: '^1.0.0',
      name: 'Guia do Escritório',
      description: 'Adiciona uma página de guia rápido ao menu do escritório.',
      publisher: { name: 'Curatino' },
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
                  'Esta página foi **adicionada por uma extensão** — não faz parte do sistema base. Ela demonstra que um plugin pode trazer uma tela própria, descrita de forma declarativa e renderizada com segurança pelo Curatino.',
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
            'A extensão **Guia do Escritório** adiciona uma página ao menu lateral. É um exemplo de como uma extensão pode entregar **interface própria** — descrita como dado e renderizada pelo Curatino, sem executar código de terceiro no navegador.',
        },
        {
          type: 'banner',
          message: 'Após instalar, procure o item "Guia" no menu à esquerda.',
          variant: 'info',
        },
      ],
    },
    workflows: [],
  },
  vendasPlugin,
];
