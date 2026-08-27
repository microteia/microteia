import { describe, expect, it } from 'vitest';
import { applyPlanToCatalog, buildArtifactPlan } from './artifactPlan';
import { buildDomainCatalog } from './catalog';
import type { DomainIssue } from './domainModel';
import { validateDomainModel } from './validateDomainModel';
import { CORPUS, clinicModel, schoolModel, supportModel } from './corpus.test-support';
import { SCREEN_PLAN_HUMAN_DECISIONS, SCREEN_PLAN_RULES } from './screenPlan';

/**
 * O CORPUS. Um par positivo/negativo por detector prova que ele não dispara no caso que quem o
 * escreveu imaginou — não que um modelo bom INTEIRO passa, que é o que decide se o portão serve.
 *
 * Estes três foram escritos ao natural e, na primeira passada, produziram QUATRO erros e TRÊS avisos,
 * todos falsos: `Ticket.requesterCode` (o código do chamado no sistema do solicitante),
 * `Ticket.agentNotes` (a anotação do atendente NESTE chamado), `Appointment.insuranceCode` (a
 * autorização deste atendimento), `Enrollment.studentNumber` (o número de chamada), e um aviso por
 * endereço achatado — em que o detector acusava o modelo de não ter dado nome a um conceito que se
 * chama Address e que a própria plataforma tinha acabado de achatar.
 *
 * Nenhum fixture foi ajustado. Dois detectores mudaram, e o registro do porquê está neles.
 *
 * Na passada em que os três ganharam COMPORTAMENTO, apareceu o quinto: `behavior.state.unreachable`
 * sobre `Enrollment.completed`, um estado que só o efeito do fluxo da turma atinge. Terceiro detector
 * afrouxado, mesmo motivo, e o fixture continuou intacto.
 *
 * E na passada em que passaram a render PLANO DE TELA, o fixture mudou pela primeira vez: toda transição
 * de gesto ganhou `description`. Não foi conforto de detector — o vocabulário não existia quando eles
 * foram escritos, e um fluxo chamável sem descrição é invisível para o passo que escolhe fluxo por
 * conta própria. O que este arquivo cobra desde então é o plano inteiro: as telas certas, nenhuma para
 * o filho no menu, nenhuma para a lista de opções, o derivado somente leitura, o estado na listagem, e
 * uma ação por gesto com o `disabledWhen` que a invariante `blocks` produziu.
 */
const CATALOG = buildDomainCatalog([]);

const bySeverity = (issues: readonly DomainIssue[], severity: DomainIssue['severity']): DomainIssue[] =>
  issues.filter((one) => one.severity === severity);

const describeIssues = (issues: readonly DomainIssue[]): string =>
  issues.map((one) => `${one.code} @ ${one.entity ?? '-'}.${one.field ?? '-'}: ${one.message}`).join('\n');

describe('modelos bons passam inteiros', () => {
  it.each(CORPUS.map((one) => [one.name, one.model] as const))(
    '"%s" valida sem NENHUM erro',
    (_name, model) => {
      const result = validateDomainModel(model(), CATALOG);
      expect(describeIssues(bySeverity(result.issues, 'error'))).toBe('');
      expect(result.ok).toBe(true);
    },
  );

  /**
   * E sem aviso nenhum também. Um aviso que aparece em todo modelo bom é ruído, e ruído é como se
   * aprende a não ler o relatório — o mesmo caminho pelo qual um erro de verdade passa despercebido.
   */
  it.each(CORPUS.map((one) => [one.name, one.model] as const))(
    '"%s" também não produz aviso nenhum',
    (_name, model) => {
      const result = validateDomainModel(model(), CATALOG);
      expect(describeIssues(bySeverity(result.issues, 'warning'))).toBe('');
    },
  );

  it.each(CORPUS.map((one) => [one.name, one.model] as const))(
    '"%s" chega a um plano de artefatos',
    (_name, model) => {
      const plan = buildArtifactPlan(model(), CATALOG);
      expect(plan.ok).toBe(true);
      expect(plan.screens.every((one) => one.operation === 'create')).toBe(true);
    },
  );

  /**
   * E agora eles rendem PLANO DE TELA, não só validação. Cada asserção aqui é uma das regras do item
   * 1 conferida sobre três domínios escritos ao natural — que é diferente de conferi-la sobre um
   * fixture desenhado para ela.
   */
  it.each(CORPUS.map((one) => [one.name, one.model] as const))(
    '"%s" rende um plano de tela que obedece a cada regra, sobre modelo escrito ao natural',
    (_name, model) => {
      const source = model();
      const result = buildArtifactPlan(source, CATALOG);
      const layouts = result.screenPlan.screens;

      for (const entity of source.entities) {
        const layout = layouts.find((one) => one.entity === entity.name);

        // Lista de opções e objeto de valor NUNCA rendem tela — e o plano diz no que eles rendem.
        if (entity.kind === 'lookup' || entity.kind === 'valueObject') {
          expect(layout, `${entity.name} ganhou tela`).toBeUndefined();
          expect(result.screenPlan.notScreens.some((one) => one.entity === entity.name)).toBe(true);
          continue;
        }

        expect(layout, `${entity.name} não ganhou tela`).toBeDefined();
        // Campo-título obrigatório: sem ele a listagem inteira lê igual.
        expect(layout?.titleFieldKey).toBe(entity.titleField);
        expect(layout?.listColumns[0].key).toBe(entity.titleField);
        // Filho é ABA do pai, raiz é menu e detalhe. Sem exceção.
        expect(layout?.presence).toBe(entity.kind === 'child' ? 'tab-of-parent' : 'menu-and-detail');
        if (entity.kind === 'child') expect(layout?.parent).toBeDefined();

        // Todo derivado é somente leitura, e todo somente leitura é derivado.
        const derived = entity.fields.filter((one) => one.semanticType === 'derived').map((one) => one.key);
        expect(layout?.readOnlyFields.map((one) => one.key).sort()).toEqual(derived.sort());

        // O estado vai para a listagem e é filtrável.
        const state = source.behavior?.states.find((one) => one.entity === entity.name);
        if (state !== undefined) {
          expect(layout?.listColumns.map((one) => one.key)).toContain(state.field);
          expect(layout?.filterableFields.map((one) => one.key)).toContain(state.field);
        }

        // O rótulo do apontado nunca é copiado para um campo: ele é resolvido no render.
        for (const reference of layout?.referenceFields ?? []) {
          expect(reference.points).not.toBe('');
          expect(reference.labelResolvedBy).toContain('Never a second field');
        }
      }

      // Uma ação de registro por transição de GESTO, e nenhuma pelas de gravação.
      const gestures = (source.behavior?.transitions ?? []).filter((one) => one.trigger.kind === 'user-action');
      const actions = layouts.flatMap((one) => one.actions);
      expect(actions.map((one) => one.key).sort())
        .toEqual(gestures.map((one) => (one.trigger as { action: string }).action).sort());

      for (const action of actions) {
        // O `disabledWhen` sempre carrega o `from`, e mais uma cláusula por invariante que bloqueia.
        const transition = gestures.find((one) => one.name === action.transition);
        const blocking = (source.behavior?.invariants ?? [])
          .filter((one) => one.transition === action.transition && one.enforcement === 'blocks');
        expect(action.disabledWhen.split(' || ').length).toBe(1 + blocking.length);
        for (const one of blocking) expect(action.disabledWhen).toContain(`!(${one.expression})`);
        expect(action.disabledWhen).toContain(`"${transition?.from}"`);
        // E a ação sempre sabe qual parâmetro o fluxo dela precisa.
        expect(action.requiresParameter).toBeDefined();
      }

      // A IDENTIDADE UNIVERSAL de cada tela, emitida e única. É o valor que uma versão seguinte tem de
      // repetir para ATUALIZAR a tela em vez de instalar uma segunda ao lado dela — e ele não pode
      // depender de nada que uma pessoa reescreva, por isso é o id do pacote mais a coleção.
      const namespace = source.extensionId ?? source.target;
      for (const layout of layouts) {
        expect(layout.sourceId, `${layout.collection} sem identidade`).toBe(`${namespace}:${layout.collection}`);
        expect(layout.sourceIdFrom).toBe('derived');
      }
      expect(new Set(layouts.map((one) => one.sourceId)).size).toBe(layouts.length);

      // O que o plano NÃO decide, ele nomeia. Sempre — e toda colocação em aberto entra na lista, para
      // que "escolha humana" não fique escondida dentro da ação.
      for (const decision of SCREEN_PLAN_HUMAN_DECISIONS) expect(result.screenPlan.humanDecisions).toContain(decision);
      const open = actions.filter((one) => one.placement === 'human-choice');
      for (const one of open) {
        expect(result.screenPlan.humanDecisions.some((line) => line.includes(one.key))).toBe(true);
      }
      // E toda regra do plano de telas é uma regra DECLARADA, não uma decisão avulsa deste teste.
      expect(SCREEN_PLAN_RULES.length).toBeGreaterThan(0);
    },
  );

  it.each(CORPUS.map((one) => [one.name, one.model] as const))(
    '"%s" reconcilia: a segunda passada não propõe nada',
    (_name, model) => {
      const first = buildArtifactPlan(model(), CATALOG);
      const second = buildArtifactPlan(model(), applyPlanToCatalog(CATALOG, first));
      expect(second.screens.map((one) => one.operation)).toStrictEqual(second.screens.map(() => 'unchanged'));
      expect(second.versionBump).toBeNull();
    },
  );
});

/**
 * Os casos que MAIS parecem defeito e não são, um a um. Cada `it` aqui é o registro de um falso
 * positivo que existiu de verdade — sem eles, a próxima mudança no detector o traz de volta.
 */
describe('o que parece defeito e não é', () => {
  it('o código que o SOLICITANTE forneceu é dado do chamado, não do solicitante', () => {
    const result = validateDomainModel(supportModel(), CATALOG);
    const about = result.issues.filter((one) => one.field === 'requesterCode');
    expect(about).toEqual([]);
  });

  it('a anotação que o ATENDENTE escreve no chamado é do chamado', () => {
    const result = validateDomainModel(supportModel(), CATALOG);
    expect(result.issues.filter((one) => one.field === 'agentNotes')).toEqual([]);
  });

  it('a autorização que o CONVÊNIO devolveu é do atendimento — outro atendimento tem outra', () => {
    const result = validateDomainModel(clinicModel(), CATALOG);
    expect(result.issues.filter((one) => one.field === 'insuranceCode')).toEqual([]);
  });

  it('o número de chamada é da MATRÍCULA: o mesmo aluno tem outro no ano seguinte', () => {
    const result = validateDomainModel(schoolModel(), CATALOG);
    expect(result.issues.filter((one) => one.field === 'studentNumber')).toEqual([]);
  });

  it('um nome de terceiro que ninguém modela não é acoplamento — não há a quem apontar', () => {
    const result = validateDomainModel(schoolModel(), CATALOG);
    expect(result.issues.filter((one) => one.field === 'teacherName')).toEqual([]);
  });

  it('o snapshot legítimo passa, e continua sendo um snapshot no modelo expandido', () => {
    const result = validateDomainModel(supportModel(), CATALOG);
    expect(result.issues.filter((one) => one.field === 'requesterName')).toEqual([]);
    const field = result.expanded.model.entities
      .find((one) => one.name === 'Ticket')?.fields.find((one) => one.key === 'requesterName');
    expect(field?.semanticType).toBe('snapshot');
    expect(field?.reason).toContain('renaming a requester');
  });

  it('o endereço achatado é INFORMADO, nunca acusado de ser um conceito sem nome', () => {
    const result = validateDomainModel(clinicModel(), CATALOG);
    expect(result.issues.filter((one) => one.code === 'domain.field.prefix-group-unnamed')).toEqual([]);
    const info = result.issues.find((one) => one.code === 'domain.field.embedded-flattened');
    expect(info?.severity).toBe('info');
    expect(info?.message).toContain('homeStreet, homeCity, homeState, homeZip');
  });

  /**
   * O QUINTO, e o mais comum de todos: `Enrollment.completed` não é atingido por transição nenhuma
   * de Enrollment — quem o atinge é o efeito de `finish-classes`, que é um fluxo de SchoolClass.
   * Isso é mecanismo real (o efeito vira um passo `upsert`), e o detector só olhava as transições da
   * própria entidade. Sem o afrouxamento, `npm test` reprova o modelo bom aqui.
   */
  it('o estado atingido pelo efeito de OUTRO fluxo não é inalcançável', () => {
    const result = validateDomainModel(schoolModel(), CATALOG);
    expect(result.issues.filter((one) => one.code === 'behavior.state.unreachable')).toEqual([]);
    expect(result.issues.filter((one) => one.code === 'behavior.state.dead-end')).toEqual([]);
  });

  it('a invariante que BLOQUEIA, pendurada num gesto, passa — é o único lugar onde ela cabe', () => {
    for (const model of [supportModel, clinicModel, schoolModel]) {
      const result = validateDomainModel(model(), CATALOG);
      expect(result.issues.filter((one) => one.code === 'behavior.invariant.blocks-after-the-fact')).toEqual([]);
      expect(result.issues.filter((one) => one.code === 'behavior.invariant.transition-without-enforcement')).toEqual([]);
    }
  });

  it('a lista de opções que poderia ser confundida com entidade não vira uma', () => {
    const result = validateDomainModel(supportModel(), CATALOG);
    expect(result.issues.filter((one) => one.code === 'domain.entity.lookup-with-attributes')).toEqual([]);
    const plan = buildArtifactPlan(supportModel(), CATALOG);
    // Ela é uma LISTA no plano — não ganha tela, nem coleção de registros, nem quatro permissões.
    expect(plan.lookups.map((one) => one.collection)).toContain('ticketCategories');
    expect(plan.screens.map((one) => one.collection)).not.toContain('ticketCategories');
  });
});

/**
 * E o corpus não pode virar um jeito de o detector calar: os defeitos de verdade continuam sendo
 * pegos DENTRO destes mesmos modelos.
 */
describe('e o portão continua fechando sobre o defeito de verdade', () => {
  it('a venda com o cliente dentro dela, no domínio de suporte', () => {
    const model = supportModel();
    const ticket = model.entities.find((one) => one.name === 'Ticket');
    ticket?.fields.push(
      { key: 'requesterEmail', label: 'e', semanticType: 'scalar', type: 'text' },
      { key: 'requesterPhone', label: 'p', semanticType: 'scalar', type: 'text' },
    );
    const issue = validateDomainModel(model, CATALOG).issues.find((one) => one.code === 'domain.field.prefix-group');
    expect(issue?.severity).toBe('error');
    expect(issue?.message).toContain('belong to Requester');
  });

  it('os procedimentos numerados, no domínio da clínica', () => {
    const model = clinicModel();
    const appointment = model.entities.find((one) => one.name === 'Appointment');
    appointment?.fields.push(
      { key: 'procedureName1', label: 'a', semanticType: 'scalar', type: 'text' },
      { key: 'procedureName2', label: 'b', semanticType: 'scalar', type: 'text' },
    );
    const codes = validateDomainModel(model, CATALOG).issues.map((one) => one.code);
    expect(codes).toContain('domain.field.numbered-collection');
  });

  it('a invariante que precisa BLOQUEAR, pendurada no gatilho de gravação, no domínio de suporte', () => {
    const model = supportModel();
    const behavior = model.behavior;
    const invariant = behavior?.invariants.find((one) => one.transition === 'assign-on-save');
    if (invariant) invariant.enforcement = 'blocks';
    const issue = validateDomainModel(model, CATALOG).issues
      .find((one) => one.code === 'behavior.invariant.blocks-after-the-fact');
    expect(issue?.severity).toBe('error');
    expect(issue?.message).toContain('onDocumentWritten');
  });

  it('a chave estrangeira escondida num escalar, no domínio da escola', () => {
    const model = schoolModel();
    const assessment = model.entities.find((one) => one.name === 'Assessment');
    assessment?.fields.push({ key: 'guardianId', label: 'g', semanticType: 'scalar', type: 'text' });
    const issue = validateDomainModel(model, CATALOG).issues
      .find((one) => one.code === 'domain.field.reference-without-relationship');
    expect(issue?.severity).toBe('error');
  });
});
