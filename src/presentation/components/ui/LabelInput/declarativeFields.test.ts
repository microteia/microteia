import { describe, expect, it } from 'vitest';
// As fontes chegam como TEXTO, pelo mesmo caminho de `hostApiTypeDefs.test.ts` e das views de
// extensão: `?raw` em vez de `node:fs`, que o projeto do app não tipa.
import VIEW_WORKFLOW from '../../../pages/ViewWorkflow/ViewWorkflow.view.tsx?raw';
import VIEW_ACTION from '../../../pages/ViewAction/ViewAction.view.tsx?raw';
import VIEW_SCRIPT from '../../../pages/ViewScript/ViewScript.view.tsx?raw';
import PARAMETERS_EDITOR from '../../../pages/ViewWorkflow/components/WorkflowParametersEditor/WorkflowParametersEditor.view.tsx?raw';
import SCREEN_BUILDER from '../../../pages/ScreenBuilder/ScreenBuilder.view.tsx?raw';
import PLUGIN_AUTHOR from '../../../pages/PluginAuthor/PluginAuthor.view.tsx?raw';
import CODE_VIEW_EDITOR from '../../../pages/PluginAuthor/CodeViewEditorModal/CodeViewEditorModal.view.tsx?raw';

/**
 * A LISTA dos campos que editam um rótulo declarativo, e o teste que a mantém honesta.
 *
 * Existe porque este é o defeito que voltou três vezes seguidas, sempre do mesmo jeito: alguém
 * renderiza o valor num `Input` comum, a referência (`@ns/chave`) aparece na tela de quem não a lê, e
 * ninguém descobre até abrir o formulário. O caminho inverso é pior e mais silencioso — resolver o
 * valor antes de mostrá-lo faz o próximo "Salvar" gravar o texto por cima da referência e apagar a
 * tradução de todos os outros idiomas.
 *
 * `LabelInput` é a única forma que resolve as duas metades, então o que este teste guarda é o vínculo:
 * cada campo desta lista continua ligado a ele. É teste de FONTE, como `viewSources.test.ts` e
 * `hostApiTypeDefs.test.ts`, pela mesma razão — o que se quer garantir é uma decisão de escrita, e o
 * comportamento do componente já tem os testes dele ao lado.
 *
 * Um campo NOVO que nasça errado não é pego aqui; para esse, a defesa é a linha nesta tabela ser óbvia
 * de acrescentar. O que ele pega é o retrocesso de um dos que já foram resolvidos.
 */
const CAMPOS_DE_ROTULO_DECLARATIVO: { tela: string; fonte: string; campos: string[] }[] = [
  {
    tela: 'ViewWorkflow',
    fonte: VIEW_WORKFLOW,
    campos: ['vm.formData.name', 'vm.formData.description'],
  },
  {
    tela: 'ViewAction',
    fonte: VIEW_ACTION,
    campos: ['vm.formData.title', 'vm.formData.confirmMessage'],
  },
  {
    tela: 'ViewScript',
    fonte: VIEW_SCRIPT,
    campos: ['vm.formData.name', 'vm.formData.description'],
  },
  {
    tela: 'WorkflowParametersEditor',
    fonte: PARAMETERS_EDITOR,
    campos: ['parameter.label'],
  },
  {
    // O Form Design edita o rótulo da PRÓPRIA tela e dos campos dela — o caso em que a regra nasceu,
    // e o último a ser corrigido, porque a regra tinha sido escrita como se não houvesse saída.
    tela: 'ScreenBuilder',
    fonte: SCREEN_BUILDER,
    campos: [
      'vm.screenForm.titleSingular',
      'vm.screenForm.titlePlural',
      'vm.fieldForm.label',
      'vm.fieldForm.section',
      'vm.fieldForm.placeholder',
    ],
  },
  {
    // A tela de autoria empacota o que o escritório fez, e o que já vem embarcado de outra extensão
    // chega com a referência dela. Só o IDENTIFICADOR fica de fora: ele não é rótulo, é o endereço do
    // pacote. `version` entra pela regra, e nela o componente é inerte — um semver nunca é referência.
    tela: 'PluginAuthor',
    fonte: PLUGIN_AUTHOR,
    campos: ['vm.form.name', 'vm.form.version', 'vm.form.summary', 'vm.form.description'],
  },
  {
    tela: 'CodeViewEditorModal',
    fonte: CODE_VIEW_EDITOR,
    campos: ['view.title'],
  },
];

const elementoDoCampo = (fonte: string, campo: string): string | null => {
  const posicao = fonte.indexOf(`value={${campo}}`);
  if (posicao === -1) return null;
  const abertura = fonte.lastIndexOf('<', posicao);
  return /^<([A-Za-z][\w.]*)/.exec(fonte.slice(abertura))?.[1] ?? null;
};

describe('o campo que edita rótulo declarativo é LabelInput', () => {
  it.each(CAMPOS_DE_ROTULO_DECLARATIVO.map((entrada) => [entrada.tela, entrada] as const))(
    '%s',
    (_tela, { fonte, campos }) => {
      campos.forEach((campo) => {
        expect(elementoDoCampo(fonte, campo), `${campo}: o campo saiu da tela ou trocou de elemento`)
          .toBe('LabelInput');
      });
    },
  );

  it('cada campo tem UM ponto de edição — dois seria o retrocesso escondido atrás de um branch', () => {
    CAMPOS_DE_ROTULO_DECLARATIVO.forEach(({ tela, fonte, campos }) => {
      campos.forEach((campo) => {
        expect(fonte.split(`value={${campo}}`).length - 1, `${tela} › ${campo}`).toBe(1);
      });
    });
  });
});
