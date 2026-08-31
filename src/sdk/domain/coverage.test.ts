import { describe, expect, it } from 'vitest';
import { COVERAGE_SURFACES, coverageGaps, coverageSummary, mechanismCoverage } from './coverage';
import { CONTROL_STEP_TYPES, CORE_STEP_DEFINITION_IDS, UNIMPLEMENTED_STEP_TYPES } from '../../domain/schema/workflowStepCatalog';
import { WORKFLOW_EVENT_CATALOG } from '../../domain/schema/eventCatalog';

/**
 * A LISTA DAS LACUNAS, carimbada.
 *
 * Este teste não pede que as lacunas fechem. Ele pede que uma lacuna NOVA apareça aqui em vez de ser
 * descoberta por acidente três fases depois — que foi exatamente o que aconteceu com a descrição da
 * transição: o mecanismo existia, o vocabulário não o alcançava, e ninguém soube até alguém tropeçar.
 *
 * É a mesma mecânica de `VERSAO_CONFERIDA` e de `PUBLISHED` em `sdkSurface.test.ts`: a mudança não é
 * impedida, ela é obrigada a passar por atualizar a lista — que é onde a decisão fica registrada. Um
 * passo registrado amanhã, uma propriedade nova em `ScreenModuleTemplate`, um ponto de extensão novo:
 * qualquer um deles reprova aqui, e quem o acrescentou decide se o modelo deve saber pedi-lo.
 */
const LACUNAS_CONFERIDAS = [
  // Os passos que o comportamento não sabe pedir. `query` é o maior de todos: é a metade que falta a
  // toda regra que compara um registro com os outros, e é por isso que o guard que precisa de outros
  // registros é RECUSADO em vez de traduzido.
  'workflow-step\tregister-audit',
  'workflow-step\tset-variable',
  'workflow-step\tmap',
  'workflow-step\tscript',
  'workflow-step\tai-detect-workflow',
  'workflow-step\tai-extract-parameters',
  'workflow-step\tquery',
  'workflow-step\tLoop',

  // Os inputs OBRIGATÓRIOS dos passos que o modelo pede e não consegue preencher. `upsert.upsert` é o
  // que mais dói: o efeito diz entidade, campo e valor, e nunca QUAL registro.
  'step-input\tnotify.title',
  'step-input\tnotify.message',
  'step-input\tvalidate-object.validate',
  'step-input\tupsert.upsert',
  'step-input\tremove.remove',

  // O gatilho de lista: "quando o escritório renomeia um status".
  'workflow-event\tlookup.saved',
  'workflow-event\tlookup.deleted',

  // Vinte dos vinte e um pontos de contribuição. O modelo alcança `access.permission` e nada mais —
  // tudo que uma regra precise além de dado e passagem está fora deste vocabulário.
  'extension-point\tui.page',
  'extension-point\tui.nav',
  'extension-point\tui.record.action',
  'extension-point\tui.command',
  'extension-point\tui.widget',
  'extension-point\tui.settings',
  'extension-point\tui.tab',
  'extension-point\tui.slot',
  'extension-point\tui.menu',
  'extension-point\tdata.entity',
  'extension-point\tdata.lookup',
  'extension-point\tdata.service',
  'extension-point\tdata.field.preset',
  'extension-point\tdata.external.lookup',
  'extension-point\ti18n.messages',
  'extension-point\ttheme.definition',
  'extension-point\ttheme.tokens',
  'extension-point\taccess.resource',
  'extension-point\taccess.requirement',
  'extension-point\tauth.provider',

  // Os artefatos de pacote que o plano nunca preenche.
  'package-artifact\tsummary',
  'package-artifact\tscripts',
  'package-artifact\tviews',
  'package-artifact\tstartup',
  'package-artifact\toverview',

  // As propriedades de tela. `sourceId` SAIU desta lista: era a mais consequente de todas — sem ela a
  // versão seguinte instala uma SEGUNDA tela em vez de atualizar esta, e nada na tela diz que foi isso
  // que aconteceu —, e o plano passou a emiti-la (id da extensão + coleção), com o valor já registrado
  // tendo precedência sobre qualquer derivação. Ver `SCREEN_SOURCE_ID_PRECEDENCE`.
  'screen-property\tsourceRev',
  'screen-property\ticon',
  'screen-property\tsubtitleFieldKey',
  'screen-property\timageFieldKey',
  'screen-property\teventPrefix',
  'screen-property\tauditActions',
  'screen-property\trecordTabPrefix',
  'screen-property\tmemberWritableFields',
  'screen-property\tauthorCanDelete',
  'screen-property\tlistActions',
  'screen-property\tsidebarOrder',
  'screen-property\thideFromParentTabs',

  // As propriedades da ação. `title` é a família da descrição da transição, ainda aberta: o modelo diz
  // o que a passagem FAZ e nunca como o botão se chama. E `confirmMessage`/`danger` dependem de uma
  // noção que o modelo não tem — "esta passagem é irreversível".
  'action-property\ttitle',
  'action-property\ticon',
  'action-property\tcommand',
  'action-property\tactiveWhen',
  'action-property\tconfirmMessage',
  'action-property\tpromptParameters',
  'action-property\tparameterDefaults',
  'action-property\tdanger',
  'action-property\torder',
  'action-property\townerPluginIds',
  'action-property\tsourceId',
  'action-property\tsourceRev',

  'workflow-property\tversion',
  'workflow-property\tlookupCollection',
  'workflow-property\townerPluginIds',
  'workflow-property\tsourceId',
  'workflow-property\tsourceRev',

  // O manifest. Quase todo ele é produto ou toolchain, e é certo que esteja fora — menos `backend`,
  // que é a lacuna real: uma regra que filtra uma coleção grande implica um índice, e o modelo não tem
  // como dizer qual.
  'manifest-property\tkernel',
  'manifest-property\tname',
  'manifest-property\tdescription',
  'manifest-property\ticon',
  'manifest-property\thomepage',
  'manifest-property\tpublisher',
  'manifest-property\tlicense',
  'manifest-property\tdependencies',
  'manifest-property\texports',
  'manifest-property\tprovides',
  'manifest-property\tconsumes',
  'manifest-property\textensionPoints',
  'manifest-property\tlifecycle',
  'manifest-property\tbackend',
];

const key = (one: { surface: string; id: string }): string => `${one.surface}\t${one.id}`;

describe('a cobertura de mecanismo', () => {
  it('é exatamente a lista de lacunas conferida — uma nova reprova aqui, e não três fases depois', () => {
    expect(coverageGaps().map(key)).toEqual(LACUNAS_CONFERIDAS);
  });

  /**
   * O relatório é derivado, então a superfície tem de ser a REAL. Se um passo registrado não aparecer,
   * a lista está incompleta e não há como saber disso olhando para ela.
   */
  it('percorre todo passo registrado, menos o que nunca foi implementado', () => {
    const covered = mechanismCoverage().filter((one) => one.surface === 'workflow-step').map((one) => one.id);
    const expected = [...CORE_STEP_DEFINITION_IDS, ...CONTROL_STEP_TYPES]
      .filter((id) => !(UNIMPLEMENTED_STEP_TYPES as readonly string[]).includes(id));
    expect(covered.sort()).toEqual([...expected].sort());
  });

  it('percorre todo evento do catálogo estático', () => {
    const covered = mechanismCoverage().filter((one) => one.surface === 'workflow-event').map((one) => one.id);
    expect(covered.sort()).toEqual(WORKFLOW_EVENT_CATALOG.map((one) => one.name).sort());
  });

  /** Todo item classificado, sem repetição: um id duas vezes esconde uma das duas classificações. */
  it('classifica cada mecanismo uma vez só', () => {
    const keys = mechanismCoverage().map(key);
    expect(keys.length).toBe(new Set(keys).size);
  });

  /** Toda lacuna diz o que custa não poder pedi-la. Uma lacuna sem motivo é uma lista que ninguém age sobre. */
  it('toda lacuna carrega o que se perde por ela', () => {
    for (const gap of coverageGaps()) {
      expect(gap.note.startsWith('NO VOCABULARY: '), `${key(gap)} sem motivo`).toBe(true);
      expect(gap.note.length, key(gap)).toBeGreaterThan('NO VOCABULARY: '.length + 20);
    }
  });

  it('o resumo fecha com os itens, superfície por superfície', () => {
    for (const line of coverageSummary()) {
      const items = mechanismCoverage().filter((one) => one.surface === line.surface);
      expect(line.total, line.surface).toBe(items.length);
      expect(line.reached + line.gaps, line.surface).toBe(line.total);
      expect(line.total, `${line.surface} não tem mecanismo nenhum`).toBeGreaterThan(0);
    }
    expect(coverageSummary().map((one) => one.surface)).toEqual([...COVERAGE_SURFACES]);
  });
});
