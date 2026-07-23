import type { MarketplacePlugin } from '../../domain/entities/MarketplacePlugin';

/**
 * Catálogo do Marketplace — fatia vertical. Um plugin de exemplo, real e instalável, cujo único
 * artefato é um workflow. Prova a plataforma de ponta a ponta reusando o motor de automações: a
 * instalação materializa o workflow no tenant (o motor já o executa); a desinstalação o remove.
 *
 * Hoje o catálogo é código embutido; na Etapa 7 vem do registro global `plugin_registry`.
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
];
