import { describe, expect, it } from 'vitest';
import type { MarketplacePlugin } from '../../entities/MarketplacePlugin';
import type { WorkflowStep } from '../../entities/Workflow';
import { workflowStepIssues } from './workflowIntegrity';
import { PORTAL_TRACK_VIEWS_SINCE_KERNEL } from '../../schema/portal';
import { PORTAL_ROLES_SINCE_KERNEL } from '../../schema/portalRole';
import { QUERY_PAGE_SINCE_KERNEL } from '../../schema/querySpec';
import { CALLED_WORKFLOW_PATH_TYPES_SINCE_KERNEL } from '../../schema/eventCatalog';
import { HTTP_REQUEST_SINCE_KERNEL } from '../../schema/httpRequestSpec';
import { HTTP_CONNECTION_SINCE_KERNEL } from '../../schema/httpConnection';

/**
 * Cada caso aqui é um defeito que COMPILAVA e passava por toda a validação de pacote, e só falava no
 * log do motor com o fluxo em execução. A lista saiu do comentário de
 * `scripts/declarativeWorkflow.test.ts`, que já a tinha escrito anos antes de alguém a reprovar.
 */

const pacote = (steps: WorkflowStep[], dependencies?: Record<string, string>): MarketplacePlugin =>
  ({
    manifest: {
      id: 'com.example.test',
      version: '1.0.0',
      kernel: '^2.0.0',
      name: 'Test',
      ...(dependencies ? { dependencies } : {}),
    },
    summary: 'Teste',
    workflows: [{
      templateId: 'wf-teste',
      name: 'Teste',
      description: 'Teste',
      eventName: 'records.saved',
      version: 1,
      steps,
    }],
  } as unknown as MarketplacePlugin);

const mensagens = (steps: WorkflowStep[], dependencies?: Record<string, string>): string[] =>
  workflowStepIssues(pacote(steps, dependencies)).map((issue) => issue.message);

const passo = (extra: Partial<WorkflowStep>): WorkflowStep => ({
  id: 'p1',
  stepDefinitionId: 'notify',
  type: 'Action',
  order: 0,
  enabled: true,
  configuration: {
    title: { kind: 'Literal', value: 'Oi' },
    message: { kind: 'Literal', value: 'Olá' },
  },
  ...extra,
} as WorkflowStep);

describe('integridade de passo de automação', () => {
  it('um passo correto não gera problema nenhum', () => {
    expect(mensagens([passo({})])).toEqual([]);
  });

  it('reprova o id de passo que não existe no catálogo', () => {
    expect(mensagens([passo({ stepDefinitionId: 'notificar' })]))
      .toContain('@core.marketplace/issue.step.unknown-definition');
  });

  it('aceita o id desconhecido quando o pacote declara dependência — o passo pode ser de outra extensão', () => {
    expect(mensagens([passo({ stepDefinitionId: 'x.custom' })], { 'com.other.ext': '^1.0.0' }))
      .toEqual([]);
  });

  it('reprova a entrada obrigatória ausente', () => {
    expect(mensagens([passo({ configuration: { title: { kind: 'Literal', value: 'Oi' } } })]))
      .toContain('@core.marketplace/issue.step.missing-input');
  });

  it('reprova a entrada que o passo não tem', () => {
    const issues = mensagens([passo({
      configuration: {
        title: { kind: 'Literal', value: 'Oi' },
        message: { kind: 'Literal', value: 'Olá' },
        severidade: { kind: 'Literal', value: 'ALTA' },
      },
    })]);
    expect(issues).toContain('@core.marketplace/issue.step.unknown-input');
  });

  it('reprova o valor cru onde se espera um InputMapping', () => {
    expect(mensagens([passo({
      configuration: { title: 'Oi', message: { kind: 'Literal', value: 'Olá' } },
    } as unknown as Partial<WorkflowStep>)]))
      .toContain('@core.marketplace/issue.step.input-not-mapping');
  });

  it('reprova o kind de mapping que a entrada não aceita', () => {
    // `set-variable.name` só aceita Literal: o nome da variável tem de ser conhecido em design-time.
    expect(mensagens([passo({
      stepDefinitionId: 'set-variable',
      configuration: {
        name: { kind: 'Expression', expression: 'concat("a", "b")' },
        value: { kind: 'Literal', value: 1 },
      },
    })]))
      .toContain('@core.marketplace/issue.step.mapping-kind');
  });

  it('reprova o nome de variável que o motor recusaria', () => {
    expect(mensagens([passo({
      stepDefinitionId: 'set-variable',
      configuration: {
        name: { kind: 'Literal', value: 'class' },
        value: { kind: 'Literal', value: 1 },
      },
    })]))
      .toContain('@core.marketplace/issue.step.input-invalid');
  });

  it('reprova o tipo Delay, que esta versão não executa', () => {
    expect(mensagens([passo({ type: 'Delay', stepDefinitionId: '' })]))
      .toContain('@core.marketplace/issue.step.type-unimplemented');
  });

  it('reprova o passo que não nomeia entrada de catálogo nenhuma', () => {
    expect(mensagens([passo({ stepDefinitionId: '' })]))
      .toContain('@core.marketplace/issue.step.no-definition');
  });

  it('o nó de controle Condition sem condição é reprovado; com condição, passa', () => {
    expect(mensagens([passo({ type: 'Condition', stepDefinitionId: '', configuration: {} })]))
      .toContain('@core.marketplace/issue.step.control-incomplete');

    expect(mensagens([passo({
      type: 'Condition',
      stepDefinitionId: '',
      configuration: {},
      condition: { kind: 'AlwaysTrue' },
      branches: { whenTrue: [], whenFalse: [] },
    })])).toEqual([]);
  });

  it('reprova a saída lida de um passo que não existe', () => {
    expect(mensagens([passo({
      configuration: {
        title: { kind: 'Output', stepId: 'inexistente', outputId: 'id' },
        message: { kind: 'Literal', value: 'Olá' },
      },
    })]))
      .toContain('@core.marketplace/issue.step.output-unknown-step');
  });

  it('reprova a saída que o passo-alvo não publica', () => {
    const issues = mensagens([
      passo({
        id: 'gravar',
        stepDefinitionId: 'upsert',
        configuration: { upsert: { kind: 'Literal', value: { table: 'records', source: 'event' } } },
      }),
      passo({
        id: 'avisar',
        configuration: {
          title: { kind: 'Output', stepId: 'gravar', outputId: 'quantidade' },
          message: { kind: 'Literal', value: 'Olá' },
        },
      }),
    ]);
    expect(issues).toContain('@core.marketplace/issue.step.output-unknown-id');
  });

  it('aceita a saída que o passo-alvo publica de fato', () => {
    expect(mensagens([
      passo({
        id: 'gravar',
        stepDefinitionId: 'upsert',
        configuration: { upsert: { kind: 'Literal', value: { table: 'records', source: 'event' } } },
      }),
      passo({
        id: 'avisar',
        configuration: {
          title: { kind: 'Output', stepId: 'gravar', outputId: 'id' },
          message: { kind: 'Literal', value: 'Olá' },
        },
      }),
    ])).toEqual([]);
  });

  it('não reprova saída de passo com saídas dinâmicas — o nome só existe em runtime', () => {
    expect(mensagens([
      passo({
        id: 'buscar',
        stepDefinitionId: 'query',
        configuration: { query: { kind: 'Literal', value: { table: 'records' } } },
      }),
      passo({
        id: 'avisar',
        configuration: {
          title: { kind: 'Output', stepId: 'buscar', outputId: 'first.title' },
          message: { kind: 'Literal', value: 'Olá' },
        },
      }),
    ])).toEqual([]);
  });

  it('alcança os passos dentro de ramos e de repetição', () => {
    expect(mensagens([passo({
      type: 'Condition',
      stepDefinitionId: '',
      configuration: {},
      condition: { kind: 'AlwaysTrue' },
      branches: {
        whenTrue: [passo({ id: 'dentro', stepDefinitionId: 'inexistente' })],
        whenFalse: [],
      },
    })]))
      .toContain('@core.marketplace/issue.step.unknown-definition');
  });

  it('a entrada obrigatória com defaultValue não é cobrada', () => {
    // `register-audit.severity` é obrigatória e tem `defaultValue: 'LOW'`.
    expect(mensagens([passo({
      stepDefinitionId: 'register-audit',
      configuration: {
        title: { kind: 'Literal', value: 'Oi' },
        message: { kind: 'Literal', value: 'Olá' },
      },
    })])).toEqual([]);
  });

  it('aceita os inputs dinâmicos `param.*` de call-workflow', () => {
    expect(mensagens([passo({
      stepDefinitionId: 'call-workflow',
      configuration: {
        targetWorkflowId: { kind: 'Literal', value: 'wf-outro' },
        'param.cliente': { kind: 'Event', path: 'id' },
      },
    })])).toEqual([]);
  });
});

describe('integridade do gatilho de horário', () => {
  const agendada = (schedule: unknown): MarketplacePlugin => {
    const base = pacote([]);
    return {
      ...base,
      manifest: { ...base.manifest, kernel: '^2.32.0' },
      workflows: [{ ...base.workflows[0], eventName: 'schedule', schedule }],
    } as unknown as MarketplacePlugin;
  };

  it('aceita o horário que o relógio lê', () => {
    expect(workflowStepIssues(agendada({ cron: '0 8 * * MON-FRI' }))).toEqual([]);
  });

  it('recusa o horário ausente, inválido ou frequente demais, dizendo o motivo', () => {
    for (const [schedule, detail] of [
      [undefined, '@core.automation/schedule.missing'],
      [{ cron: 'todo dia às 8' }, '@core.automation/schedule.cron-invalid'],
      [{ cron: '* * * * *' }, '@core.automation/schedule.too-frequent'],
    ] as const) {
      const [issue] = workflowStepIssues(agendada(schedule));
      expect(issue?.message).toBe('@core.marketplace/issue.workflow.schedule-invalid');
      expect(issue?.messageParams?.detail).toBe(detail);
    }
  });

  it('não olha `schedule` em automação que não é de horário', () => {
    const base = pacote([]);
    const outra = { ...base, workflows: [{ ...base.workflows[0], schedule: { cron: 'x' } }] } as unknown as MarketplacePlugin;
    expect(workflowStepIssues(outra)).toEqual([]);
  });
});

describe('integridade do gatilho de data', () => {
  const comData = (eventName: string, dateReached: unknown, kernel = '^2.33.0'): MarketplacePlugin => {
    const base = pacote([]);
    return {
      ...base,
      manifest: { ...base.manifest, kernel },
      screens: [{
        key: 'prazo',
        fields: [
          { key: 'dueDate', label: 'Vencimento', type: 'date' },
          { key: 'title', label: 'Título', type: 'text' },
        ],
      }],
      workflows: [{ ...base.workflows[0], eventName, dateReached }],
    } as unknown as MarketplacePlugin;
  };

  it('aceita o campo de data da tela do pacote', () => {
    expect(workflowStepIssues(comData('prazo.dateReached', { field: 'dueDate', offset: '-3d' }))).toEqual([]);
  });

  it('recusa o campo que não é de data da tela, e o deslocamento malformado', () => {
    const details = workflowStepIssues(comData('prazo.dateReached', { field: 'title', offset: '3' }))
      .map((issue) => issue.messageParams?.detail);
    expect(details).toEqual(['@core.automation/date-reached.field-not-date', '@core.automation/date-reached.offset-invalid']);
  });

  it('a tela de fora do pacote tem só a forma conferida', () => {
    expect(workflowStepIssues(comData('case.dateReached', { field: 'qualquer', offset: '0d' }))).toEqual([]);
  });

  it('cobra o intervalo de kernel que inclui um kernel anterior ao relógio', () => {
    const [issue] = workflowStepIssues(comData('prazo.dateReached', { field: 'dueDate', offset: '0d' }, '^2.32.0'));
    expect(issue?.message).toBe('@core.marketplace/issue.workflow.trigger-kernel');
    expect(issue?.messageParams?.minimum).toBe('2.33.0');
  });
});

describe('integridade do passo de espera', () => {
  const espera = (id: string, order = 0): WorkflowStep => passo({ id, stepDefinitionId: 'delay', order, configuration: { duration: { kind: 'Literal', value: '2d' } } });

  const comEspera = (steps: WorkflowStep[], extra: Record<string, unknown> = {}, kernel = '^2.34.0'): MarketplacePlugin => {
    const base = pacote(steps);
    return { ...base, manifest: { ...base.manifest, kernel }, ...extra } as unknown as MarketplacePlugin;
  };

  it('aceita a espera no nível principal', () => {
    expect(workflowStepIssues(comEspera([espera('w')]))).toEqual([]);
  });

  it('recusa a espera dentro de um ramo de condição', () => {
    const condicao = passo({
      id: 'cond',
      type: 'Condition',
      stepDefinitionId: '',
      condition: { kind: 'AlwaysTrue' },
      branches: { whenTrue: [espera('w')], whenFalse: [] },
    });
    expect(workflowStepIssues(comEspera([condicao])).map((issue) => issue.message)).toContain('@core.marketplace/issue.step.delay-nested');
  });

  it('recusa a espera numa automação que uma ação do pacote dispara', () => {
    const issues = workflowStepIssues(comEspera([espera('w')], { actions: [{ key: 'aprovar', workflowId: 'wf-teste' }] }));
    expect(issues.map((issue) => issue.message)).toEqual(['@core.marketplace/issue.step.delay-in-action']);
  });

  it('cobra o kernel que admite uma versão sem o passo', () => {
    const [issue] = workflowStepIssues(comEspera([espera('w')], {}, '^2.33.0'));
    expect(issue?.message).toBe('@core.marketplace/issue.step.delay-kernel');
  });
});

describe('integridade do gatilho de auditoria', () => {
  const deAuditoria = (steps: WorkflowStep[], kernel = '^2.45.0'): MarketplacePlugin => {
    const base = pacote(steps);
    return {
      ...base,
      manifest: { ...base.manifest, kernel },
      workflows: [{ ...base.workflows[0], eventName: 'audit.recorded' }],
    } as unknown as MarketplacePlugin;
  };

  const registrarAuditoria = (id: string): WorkflowStep => passo({
    id,
    stepDefinitionId: 'register-audit',
    configuration: {
      title: { kind: 'Literal', value: 'Oi' },
      message: { kind: 'Literal', value: 'Olá' },
      severity: { kind: 'Literal', value: 'LOW' },
    },
  });

  it('aceita a notificação, que é o uso do gatilho', () => {
    expect(workflowStepIssues(deAuditoria([passo({})]))).toEqual([]);
  });

  it('recusa o passo que declara o gatilho como proibido, mesmo dentro de um ramo', () => {
    const condicao = passo({
      id: 'cond',
      type: 'Condition',
      stepDefinitionId: '',
      condition: { kind: 'AlwaysTrue' },
      branches: { whenTrue: [registrarAuditoria('a')], whenFalse: [] },
    });
    const [issue] = workflowStepIssues(deAuditoria([condicao]));
    expect(issue?.message).toBe('@core.marketplace/issue.step.excluded-trigger');
    expect(issue?.messageParams).toEqual({ step: 'a', definition: 'register-audit', event: 'audit.recorded' });
  });

  it('o mesmo passo em outro gatilho continua aceito', () => {
    expect(mensagens([registrarAuditoria('a')])).toEqual([]);
  });

  it('cobra o kernel que admite uma versão sem o gatilho', () => {
    const [issue] = workflowStepIssues(deAuditoria([passo({})], '^2.44.0'));
    expect(issue?.message).toBe('@core.marketplace/issue.workflow.trigger-kernel');
    expect(issue?.messageParams?.minimum).toBe('2.45.0');
  });
});

describe('compartilhar documento com o portal e eventos de nota e documento', () => {
  const comKernel = (steps: WorkflowStep[], kernel: string, eventName = 'records.saved'): MarketplacePlugin => {
    const base = pacote(steps);
    const [workflow] = base.workflows ?? [];
    return { ...base, manifest: { ...base.manifest, kernel }, workflows: [{ ...workflow, eventName }] } as unknown as MarketplacePlugin;
  };
  const compartilhar = passo({
    id: 'share',
    stepDefinitionId: 'share-documents',
    configuration: {
      collection: { kind: 'Literal', value: 'records' },
      recordId: { kind: 'Event', path: 'id' },
    },
  });
  const gerar = passo({
    id: 'render',
    stepDefinitionId: 'render-document',
    configuration: {
      templateKey: { kind: 'Literal', value: 'qualquer' },
      recordId: { kind: 'Event', path: 'id' },
      portalShared: { kind: 'Literal', value: true },
    },
  });

  it('o passo e a entrada exigem o kernel em que existem', () => {
    const issues = workflowStepIssues(comKernel([compartilhar, gerar], '^2.69.0'));
    expect(issues.map((issue) => [issue.message, issue.messageParams?.minimum])).toEqual([
      ['@core.marketplace/issue.step.definition-kernel', '2.70.0'],
      ['@core.marketplace/issue.step.input-kernel', '2.70.0'],
    ]);
    expect(workflowStepIssues(comKernel([compartilhar, gerar], '^2.70.0'))).toEqual([]);
  });

  it('o passo cobra as entradas obrigatórias', () => {
    const semRegistro = passo({ id: 'share', stepDefinitionId: 'share-documents', configuration: { collection: { kind: 'Literal', value: 'records' } } });
    expect(workflowStepIssues(comKernel([semRegistro], '^2.70.0')).map((issue) => issue.message))
      .toEqual(['@core.marketplace/issue.step.missing-input']);
  });

  it('o gatilho de documento exige o kernel em que ele vale para toda tela', () => {
    const [issue] = workflowStepIssues(comKernel([passo({})], '^2.68.0', 'records_document.saved'));
    expect(issue?.message).toBe('@core.marketplace/issue.workflow.trigger-kernel');
    expect(issue?.messageParams?.minimum).toBe('2.69.0');
    expect(workflowStepIssues(comKernel([passo({})], '^2.69.0', 'records_document.saved'))).toEqual([]);
  });
});

describe('convite e revogação do portal por automação', () => {
  const cliente = (portal: Record<string, unknown> | null) => ({
    key: 'cliente',
    titleSingular: 'Cliente',
    titlePlural: 'Clientes',
    icon: 'team',
    titleFieldKey: 'nome',
    fields: [{ key: 'nome', label: 'Nome', type: 'text', required: true, order: 0 }],
    ...(portal ? { portal } : {}),
  });
  const comTela = (steps: WorkflowStep[], kernel: string, portal: Record<string, unknown> | null): MarketplacePlugin => {
    const base = pacote(steps);
    return { ...base, manifest: { ...base.manifest, kernel }, screens: [cliente(portal)] } as unknown as MarketplacePlugin;
  };
  const acesso = (stepDefinitionId: string, subjectCollection = 'cliente') => passo({
    id: stepDefinitionId,
    stepDefinitionId,
    configuration: {
      subjectCollection: { kind: 'Literal', value: subjectCollection },
      subjectRecordId: { kind: 'Event', path: 'cliente' },
      email: { kind: 'Event', path: 'email' },
    },
  });
  const aberta = { subject: 'self', fields: ['nome'], invites: { automation: true } };

  it('os dois passos exigem o kernel em que existem', () => {
    const issues = workflowStepIssues(comTela([acesso('portal-invite'), acesso('portal-revoke')], '^2.72.0', aberta));
    expect(issues.map((issue) => [issue.message, issue.messageParams?.definition, issue.messageParams?.minimum])).toEqual([
      ['@core.marketplace/issue.step.definition-kernel', 'portal-invite', '2.73.0'],
      ['@core.marketplace/issue.step.definition-kernel', 'portal-revoke', '2.73.0'],
    ]);
    expect(workflowStepIssues(comTela([acesso('portal-invite'), acesso('portal-revoke')], '^2.73.0', aberta))).toEqual([]);
  });

  it('convidar para uma tela do pacote que não aceita convite por automação reprova no empacotamento', () => {
    const fechada = { subject: 'self', fields: ['nome'] };
    const issues = workflowStepIssues(comTela([acesso('portal-invite')], '^2.73.0', fechada));
    expect(issues.map((issue) => [issue.message, issue.messageParams?.screen])).toEqual([
      ['@core.marketplace/issue.step.portal-invite.closed', 'cliente'],
    ]);
    expect(workflowStepIssues(comTela([acesso('portal-invite')], '^2.73.0', null))
      .map((issue) => issue.message)).toEqual(['@core.marketplace/issue.step.portal-invite.closed']);
  });

  it('revogar não pede a declaração, e a tela de fora do pacote não é conferida aqui', () => {
    expect(workflowStepIssues(comTela([acesso('portal-revoke')], '^2.73.0', null))).toEqual([]);
    expect(workflowStepIssues(comTela([acesso('portal-invite', 'empresas')], '^2.73.0', null))).toEqual([]);
  });

  it('o passo cobra as entradas obrigatórias', () => {
    const semEmail = passo({
      id: 'convite',
      stepDefinitionId: 'portal-invite',
      configuration: { subjectCollection: { kind: 'Literal', value: 'cliente' }, subjectRecordId: { kind: 'Event', path: 'id' } },
    });
    expect(workflowStepIssues(comTela([semEmail], '^2.73.0', aberta)).map((issue) => issue.message))
      .toEqual(['@core.marketplace/issue.step.missing-input']);
  });

  it('a identidade exigida pede o kernel que a entende — o anterior convidaria pelo e-mail, sem prova', () => {
    const base = acesso('portal-invite');
    const comClaim = passo({
      ...base,
      configuration: {
        ...base.configuration,
        requiredClaimName: { kind: 'Literal', value: 'nationalId' },
        requiredClaimValue: { kind: 'Event', path: 'documento' },
      },
    });
    const issues = workflowStepIssues(comTela([comClaim], '^2.73.0', aberta));
    expect(issues.map((issue) => [issue.message, issue.messageParams?.minimum])).toEqual([
      ['@core.marketplace/issue.step.input-kernel', '2.74.0'],
    ]);
    expect(workflowStepIssues(comTela([comClaim], '^2.74.0', aberta))).toEqual([]);
  });

  it('o papel pede o kernel que o guarda — o anterior convidaria sem ele (EV-38)', () => {
    const base = acesso('portal-invite');
    const comPapel = passo({ ...base, configuration: { ...base.configuration, role: { kind: 'Literal', value: 'socio' } } });
    expect(workflowStepIssues(comTela([comPapel], '^2.88.0', aberta)).map((issue) => [issue.message, issue.messageParams?.input, issue.messageParams?.minimum]))
      .toEqual([['@core.marketplace/issue.step.input-kernel', 'role', PORTAL_ROLES_SINCE_KERNEL]]);
    expect(workflowStepIssues(comTela([comPapel], `^${PORTAL_ROLES_SINCE_KERNEL}`, aberta))).toEqual([]);
  });
});

describe('integridade do gatilho de abertura pelo portal', () => {
  const comPortal = (trackViews: boolean, kernel = `^${PORTAL_TRACK_VIEWS_SINCE_KERNEL}`, eventName = 'avisos.portalViewed') => {
    const base = pacote([]);
    return {
      ...base,
      manifest: { ...base.manifest, kernel },
      screens: [{
        key: 'avisos',
        fields: [{ key: 'title', label: 'Título', type: 'text' }],
        portal: { subject: 'self', fields: ['title'], ...(trackViews ? { trackViews: true } : {}) },
      }],
      workflows: [{ ...base.workflows[0], eventName }],
    } as unknown as MarketplacePlugin;
  };

  it('aceita o gatilho sobre a tela do pacote que registra as aberturas, com o kernel que o publica', () => {
    expect(workflowStepIssues(comPortal(true))).toEqual([]);
  });

  it('recusa o gatilho sobre tela do pacote que não registra — ele nunca dispararia', () => {
    expect(workflowStepIssues(comPortal(false))).toEqual([expect.objectContaining({
      message: '@core.marketplace/issue.workflow.portal-viewed.untracked',
      messageParams: { event: 'avisos.portalViewed', screen: 'avisos' },
    })]);
  });

  it('cobra o kernel que admite uma versão sem o evento', () => {
    expect(workflowStepIssues(comPortal(true, '^2.78.0'))).toEqual([expect.objectContaining({
      message: '@core.marketplace/issue.workflow.trigger-kernel',
      messageParams: { event: 'avisos.portalViewed', minimum: PORTAL_TRACK_VIEWS_SINCE_KERNEL },
    })]);
  });

  it('a tela de fora do pacote tem só o kernel conferido — a declaração dela não viaja aqui', () => {
    expect(workflowStepIssues(comPortal(false, `^${PORTAL_TRACK_VIEWS_SINCE_KERNEL}`, 'notices.portalViewed'))).toEqual([]);
  });
});

describe('upsert que endereça pela chave primary', () => {
  const comKernel = (steps: WorkflowStep[], kernel: string): MarketplacePlugin => {
    const base = pacote(steps);
    return { ...base, manifest: { ...base.manifest, kernel } } as unknown as MarketplacePlugin;
  };
  const gravar = (upsert: Record<string, unknown>) => passo({
    id: 'gravar',
    stepDefinitionId: 'upsert',
    configuration: { upsert: { kind: 'Literal', value: upsert } },
  });

  it('exige o kernel em que a opção existe — num anterior ela seria ignorada e o fluxo repetido falharia', () => {
    const porChave = gravar({ table: 'lotes', source: 'input', matchPrimaryKey: true });
    const issues = workflowStepIssues(comKernel([porChave], '^2.81.0'));
    expect(issues.map((issue) => [issue.message, issue.messageParams?.input, issue.messageParams?.minimum])).toEqual([
      ['@core.marketplace/issue.step.input-kernel', 'upsert.matchPrimaryKey', '2.82.0'],
    ]);
    expect(workflowStepIssues(comKernel([porChave], '^2.82.0'))).toEqual([]);
  });

  it('o upsert sem a opção não cobra kernel nenhum', () => {
    expect(workflowStepIssues(comKernel([gravar({ table: 'lotes', source: 'input' })], '^2.0.0'))).toEqual([]);
    expect(workflowStepIssues(comKernel([gravar({ table: 'lotes', source: 'input', matchPrimaryKey: false })], '^2.0.0'))).toEqual([]);
  });
});

describe('consulta lida em páginas', () => {
  const comKernel = (steps: WorkflowStep[], kernel: string): MarketplacePlugin => {
    const base = pacote(steps);
    return { ...base, manifest: { ...base.manifest, kernel } } as unknown as MarketplacePlugin;
  };
  const buscar = (query: Record<string, unknown>) => passo({
    id: 'buscar',
    stepDefinitionId: 'query',
    configuration: { query: { kind: 'Literal', value: { table: 'lotes', where: [], limit: 100, projections: [], ...query } } },
  });

  it('exige o kernel em que a página existe — num anterior a primeira página se repetiria para sempre', () => {
    const emPaginas = buscar({ page: { after: { kind: 'Expression', expression: 'event.cursor' } } });
    expect(workflowStepIssues(comKernel([emPaginas], '^2.82.0')).map((issue) =>
      [issue.message, issue.messageParams?.input, issue.messageParams?.minimum])).toEqual([
      ['@core.marketplace/issue.step.input-kernel', 'query.page', QUERY_PAGE_SINCE_KERNEL],
    ]);
    expect(workflowStepIssues(comKernel([emPaginas], `^${QUERY_PAGE_SINCE_KERNEL}`))).toEqual([]);
  });

  it('a consulta sem página não cobra kernel nenhum', () => {
    expect(workflowStepIssues(comKernel([buscar({})], '^2.0.0'))).toEqual([]);
  });
});

describe('notify num fluxo chamado, com caminho tipado pelos parâmetros', () => {
  const fluxo = (eventName: string, kernel: string, configuration: WorkflowStep['configuration']): MarketplacePlugin => {
    const base = pacote([passo({ id: 'avisar', configuration: { ...passo({}).configuration, ...configuration } })]);
    return {
      ...base,
      manifest: { ...base.manifest, kernel },
      workflows: base.workflows?.map((workflow) => ({ ...workflow, eventName })),
    } as unknown as MarketplacePlugin;
  };
  const caminhos: WorkflowStep['configuration'] = {
    toEmail: { kind: 'Literal', value: true },
    recipientAddresses: { kind: 'Event', path: 'pedido.clienteId.email' },
    portalRecord: { kind: 'Event', path: 'pedido' },
  };
  const kernelIssues = (plugin: MarketplacePlugin) => workflowStepIssues(plugin)
    .filter((issue) => issue.message === '@core.marketplace/issue.step.input-kernel')
    .map((issue) => [issue.messageParams?.input, issue.messageParams?.minimum]);

  it('exige o kernel em que o caminho parte dos parâmetros — antes ele reprovava o passo em execução', () => {
    expect(kernelIssues(fluxo('workflow.called', '^2.0.0', caminhos))).toEqual([
      ['recipientAddresses', CALLED_WORKFLOW_PATH_TYPES_SINCE_KERNEL],
      ['portalRecord', CALLED_WORKFLOW_PATH_TYPES_SINCE_KERNEL],
    ]);
    expect(kernelIssues(fluxo('workflow.called', `^${CALLED_WORKFLOW_PATH_TYPES_SINCE_KERNEL}`, caminhos))).toEqual([]);
  });

  it('o gatilho de registro não cobra nada — lá o caminho sempre partiu do evento', () => {
    expect(kernelIssues(fluxo('records.saved', '^2.0.0', caminhos))).toEqual([]);
  });

  it('o notify de fluxo chamado sem caminho tipado não cobra kernel nenhum', () => {
    expect(kernelIssues(fluxo('workflow.called', '^2.0.0', { recipientMembers: { kind: 'Literal', value: ['u1'] } }))).toEqual([]);
  });
});

describe('passo http-request no pacote', () => {
  const comKernel = (steps: WorkflowStep[], kernel: string): MarketplacePlugin => {
    const base = pacote(steps);
    return { ...base, manifest: { ...base.manifest, kernel } } as unknown as MarketplacePlugin;
  };
  const chamar = (request: unknown) => passo({
    id: 'chamar',
    stepDefinitionId: 'http-request',
    configuration: { request: { kind: 'Literal', value: request } },
  });
  const valida = { method: 'GET', url: { kind: 'Literal', value: 'https://api.exemplo.com/x' } };
  const mensagens = (plugin: MarketplacePlugin) => workflowStepIssues(plugin).map((issue) => issue.message);

  it('exige o kernel em que o passo existe — num anterior ele seria desconhecido', () => {
    expect(workflowStepIssues(comKernel([chamar(valida)], '^2.0.0')).map((issue) =>
      [issue.message, issue.messageParams?.definition, issue.messageParams?.minimum])).toEqual([
      ['@core.marketplace/issue.step.definition-kernel', 'http-request', HTTP_REQUEST_SINCE_KERNEL],
    ]);
    expect(workflowStepIssues(comKernel([chamar(valida)], `^${HTTP_REQUEST_SINCE_KERNEL}`))).toEqual([]);
  });

  it('recusa a requisição inválida pela mesma validação do editor e do motor', () => {
    const issues = workflowStepIssues(comKernel([chamar({ ...valida, url: { kind: 'Literal', value: 'http://api.exemplo.com' } })], `^${HTTP_REQUEST_SINCE_KERNEL}`));
    expect(issues.map((issue) => [issue.message, issue.messageParams?.detail])).toEqual([
      ['@core.marketplace/issue.step.http-invalid', '@core.automation/step.http.issue.url-https'],
    ]);
  });

  it('recusa o segredo com valor fixo — no pacote ele sairia do escritório', () => {
    const comSegredo = { ...valida, headers: [{ name: 'Authorization', value: { kind: 'Literal', value: 'Bearer abc' } }] };
    expect(mensagens(comKernel([chamar(comSegredo)], `^${HTTP_REQUEST_SINCE_KERNEL}`)))
      .toEqual(['@core.marketplace/issue.step.http-literal-secret']);
    const deVariavel = { ...valida, headers: [{ name: 'Authorization', value: { kind: 'Variable', name: 'token' } }] };
    expect(mensagens(comKernel([chamar(deVariavel)], `^${HTTP_REQUEST_SINCE_KERNEL}`))).toEqual([]);
  });

  it('a credencial pela chave exige o kernel em que ela existe', () => {
    const comCredencial = chamar({ ...valida, connection: 'crm' });
    expect(workflowStepIssues(comKernel([comCredencial], `^${HTTP_REQUEST_SINCE_KERNEL}`)).map((issue) =>
      [issue.message, issue.messageParams?.input, issue.messageParams?.minimum])).toEqual([
      ['@core.marketplace/issue.step.input-kernel', 'request.connection', HTTP_CONNECTION_SINCE_KERNEL],
    ]);
    expect(workflowStepIssues(comKernel([comCredencial], `^${HTTP_CONNECTION_SINCE_KERNEL}`))).toEqual([]);
  });

  it('a requisição que não é valor fixo é recusada', () => {
    const passoSemSpec = passo({ id: 'chamar', stepDefinitionId: 'http-request', configuration: { request: { kind: 'Event', path: 'x' } } });
    expect(mensagens(comKernel([passoSemSpec], `^${HTTP_REQUEST_SINCE_KERNEL}`))).toContain('@core.marketplace/issue.step.http-invalid');
  });
});
