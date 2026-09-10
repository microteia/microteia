import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

/**
 * Os diretórios já reescritos no idioma-fonte. Migrou um? Acrescente aqui na mesma alteração — é
 * essa lista que separa "ainda não chegou lá" de "regrediu".
 */
const MIGRATED_TO_SOURCE_LANGUAGE = [
  'src/presentation/components/**/*.{ts,tsx}',
  'src/presentation/pages/Login/**/*.{ts,tsx}',
  'src/presentation/pages/License/**/*.{ts,tsx}',
  'src/presentation/pages/ViewWorkflow/**/*.{ts,tsx}',
  'src/presentation/pages/ScreenBuilder/**/*.{ts,tsx}',
  'src/presentation/pages/PluginAuthor/**/*.{ts,tsx}',
  'src/plugins/core.*/**/*.{ts,tsx}',
  'src/plugins/messages/**/*.{ts,tsx}',
  // As extensões AGNÓSTICAS de negócio: Calendário, Painel e Notícias. Uma agenda, uma tela de
  // abertura e um mural servem a qualquer escritório do mundo, então elas nascem no idioma-fonte e
  // carregam a própria tradução. As de domínio (Processos, Prazos, Contratos) seguem fora da zona:
  // o vocabulário delas é de um ramo, e migrá-las é outra rodada.
  'src/plugins/marketplace/calendar*.ts',
  'src/plugins/marketplace/dashboard*.ts',
  'src/plugins/marketplace/news*.ts',
  'src/plugins/marketplace/views/calendar/**/*.{ts,tsx}',
  'src/plugins/marketplace/views/dashboard/**/*.{ts,tsx}',
  'src/plugins/marketplace/views/news/**/*.{ts,tsx}',
  'src/presentation/pages/Workflows/**/*.{ts,tsx}',
  'src/presentation/pages/ViewAction/**/*.{ts,tsx}',
  'src/presentation/pages/Marketplace/**/*.{ts,tsx}',
  'src/presentation/shared/**/*.{ts,tsx}',
  'src/presentation/pages/Actions/**/*.{ts,tsx}',
  'src/presentation/pages/ViewScript/**/*.{ts,tsx}',
  'src/presentation/pages/EditWorkflowStep/**/*.{ts,tsx}',
  'src/presentation/pages/Settings/**/*.{ts,tsx}',
  'src/presentation/pages/TenantSettings/**/*.{ts,tsx}',
  'src/presentation/pages/Profile/**/*.{ts,tsx}',
  'src/presentation/pages/AccessManagement/**/*.{ts,tsx}',
  'src/presentation/pages/AuditLogs/**/*.{ts,tsx}',
  'src/presentation/pages/Scripts/**/*.{ts,tsx}',
  'src/presentation/pages/FunctionReference/**/*.{ts,tsx}',
  'src/presentation/pages/DynamicRecordList/**/*.{ts,tsx}',
  'src/presentation/pages/ViewDynamicRecord/**/*.{ts,tsx}',
  'src/presentation/pages/DataProcessor/**/*.{ts,tsx}',
  'src/presentation/pages/DataFunctionReference/**/*.{ts,tsx}',
  'src/presentation/pages/Translations/**/*.{ts,tsx}',
  'src/domain/**/*.{ts,tsx}',
  'src/data/**/*.{ts,tsx}',
  'src/stores/**/*.{ts,tsx}',
  'src/infrastructure/**/*.{ts,tsx}',
  'src/presentation/hooks/**/*.{ts,tsx}',
  // O BACKEND entra pelas mesmas propriedades. Ele não tem JSX, então o que o alcança é o seletor
  // de propriedade — e é justamente ele que pega o texto SEM acento, que o gatilho por acento não
  // vê: "Objeto montado" e "Campos montados" atravessaram a migração inteira por causa disso.
  'functions/src/infrastructure/workflow/**/*.ts',
  'functions/src/domain/engine/**/*.ts',
  // As cópias GERADAS a partir de `src/domain/schema` entram junto: a fonte já está na zona, e sem
  // isto os `eslint-disable` que viajam com o arquivo apareceriam como diretiva sem uso.
  'functions/src/domain/schema/**/*.ts',
  'functions/src/domain/services/**/*.ts',
  'functions/src/plugins/**/*.ts',
  // O backend inteiro entra, menos o que a esteira do push processa: o texto de lá casa com o
  // e-mail de tribunal que ela lê, e traduzi-lo quebraria o reconhecimento.
  'functions/src/domain/usecases/**/*.ts',
  'functions/src/data/repositories/**/*.ts',
  'functions/src/infrastructure/handlers/**/*.ts',
  'src/domain/schema/plugin/**/*.{ts,tsx}',
  'src/domain/usecases/plugins/pluginReferences.ts',
  'src/domain/usecases/plugins/packageSerialization.ts',
  'src/kernel/**/*.{ts,tsx}',
  'src/domain/schema/eventCatalog.ts',
  'src/domain/schema/fieldRulePresets.ts',
]

export default defineConfig([
  globalIgnores(['dist', 'functions/lib', 'cli/lib', 'distributions', 'sdk']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  // O Console roda em Node, não no navegador: sem isto `process`, `Buffer` e `NodeJS` viram
  // no-undef. Ele também não é produto — é ferramenta de instalação —, então fica fora da zona de
  // idioma-fonte, pelo mesmo motivo que `scripts/` está.
  {
    files: ['cli/**/*.ts'],
    languageOptions: {
      globals: globals.node,
    },
  },
  // Princípio nº 1: o Kernel nunca conhece plugins. Estas zonas fazem o ESLint reprovar a
  // violação em vez de confiar em revisão manual.
  {
    files: ['src/kernel/**/*.{ts,tsx}', 'functions/src/kernel/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          { group: ['**/plugins/**'], message: 'O Kernel não pode importar plugins. Receba o manifest pelo loader.' },
          { group: ['**/presentation/**'], message: 'O Kernel não conhece a camada de apresentação.' },
          { group: ['**/data/**', '**/stores/**'], message: 'O Kernel depende só de contratos em domain/schema/plugin.' },
          { group: ['firebase', 'firebase/**', 'firebase-admin', 'firebase-admin/**'], message: 'O Kernel não fala com o backend. Injete a dependência.' },
        ],
      }],
    },
  },
  {
    files: ['src/plugins/*/**/*.{ts,tsx}', 'functions/src/plugins/*/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          { group: ['../../*/manifest', '../../*/impl/**', '../../*/contributions/**'], message: 'Um plugin não importa outro diretamente. Consuma uma Capability ou contribua para um Extension Point.' },
        ],
      }],
    },
  },
  // O inglês é o idioma-fonte do produto: texto em português dentro do código volta a ser um pacote
  // de tradução, nunca um literal. `MIGRATED_TO_SOURCE_LANGUAGE` cresce a cada diretório migrado — é
  // o que impede o que já migrou de regredir. Ver "Idioma" no CLAUDE.md e "A migração para o
  // idioma-fonte" no ARCHITECTURE.md.
  //
  // A regra é AGNÓSTICA DE IDIOMA onde consegue ser: dentro da zona, texto de usuário não pode ser
  // literal — nem em português, nem em inglês. `JSXText` e os atributos que carregam texto (`title`,
  // `label`, `placeholder`, `message`…) exigem `{t('chave')}`.
  //
  // A primeira versão disparava só por ACENTO, e isso foi um erro medido: ela não via "Nome",
  // "Geral", "Salvar", "Habilitado", "Mover para cima" — e um teste com o pacote pt-BR DESLIGADO
  // encontrou 242 desses em diretórios dados como concluídos. Palavra curta sem acento é a maior
  // parte do texto de interface, justamente o que a regra precisava pegar.
  //
  // O gatilho por acento CONTINUA, aplicado a `Literal` e `TemplateElement`, para o que não é JSX:
  // notificação, item de `options`, mensagem de erro montada em função.
  //
  // Fora da zona ficam os testes (nome de teste é comunicação nossa e continua em português) e os
  // catálogos de tradução, que é justamente onde o português deve estar.
  {
    files: MIGRATED_TO_SOURCE_LANGUAGE,
    ignores: [
      '**/*.test.{ts,tsx}',
      // As definições de tipo que viram IntelliSense para quem escreve um Script. São DOCUMENTAÇÃO DE
      // API, não texto de runtime — não passam por catálogo e não têm como ser traduzidas em tempo de
      // execução —, e devem ir para o inglês como as de extensão já foram.
      'src/presentation/pages/ViewScript/scriptTypeDefs.ts',
      // O mesmo caso, do lado do agente de IA: a descrição de cada ferramenta e de cada recurso do
      // MCP de execução é documentação de API entregue a quem CONSOME a superfície — o mesmo leitor
      // de `extensionTypeDefs.ts` e do `AUTHORING.md`, e por isso já escrita em inglês. Ela não passa
      // por catálogo por decisão: são ~40 frases que guiam um modelo, não texto que alguém lê na
      // tela, e traduzi-las obrigaria a manter em pt-BR a documentação de uma API cujo idioma é o
      // inglês. O que a regra continua cobrando é o que importa — a TELA que gerencia os acessos, que
      // é texto de usuário e nasce no catálogo.
      'src/domain/schema/agent/agentOps.ts',
      'functions/src/domain/schema/agent/agentOps.ts',
      // A esteira do Gmail/push pertence ao plugin de push, que não é traduzido nesta rodada —
      // o texto dela casa com o e-mail de tribunal que ela processa.
      'functions/src/domain/services/gmailPushAuditText.ts',
      'functions/src/data/services/EmailParserService.ts',
      'functions/src/infrastructure/handlers/gmailPush.ts',
      'functions/src/infrastructure/handlers/shared/gmailPushRunLogger.ts',
      // Comentário de CSS vive DENTRO do template literal, e comentário continua em português. Num
      // arquivo de estilo não há texto de usuário para proteger, então ele fica fora da zona.
      '**/*.styles.tsx',
      // A TRADUÇÃO que viaja dentro do próprio plugin. A regra existe para impedir que o produto
      // nasça em português; um catálogo `pt-BR` é o oposto disso — é o lugar onde o português deve
      // estar, como já vale para `marketplace/localePtBr`. O que a regra continua cobrando do
      // plugin é o que importa: a chave nasce em inglês em `src/plugins/messages/`, e é dela que
      // este arquivo é o par.
      'src/plugins/*/messages*.ts',
      // O mesmo, para a extensão que carrega o próprio par de catálogos ao lado do arquivo de plugin.
      'src/plugins/marketplace/*MessagesPtBr.ts',
    ],
    rules: {
      'no-restricted-syntax': ['error',
        // Diagnóstico fica de fora: `console.*` e `logger.*` (incluindo `context.logger.warn`) são
        // para NÓS, não texto de usuário — mesma natureza do comentário de código, que a regra de
        // idioma mantém em português de propósito.
        {
          selector: 'Literal[value=/[áàâãéêíóôõúüçÁÀÂÃÉÊÍÓÔÕÚÜÇ]/]:not(CallExpression[callee.object.name=\'console\'] Literal):not(CallExpression[callee.object.property.name=\'logger\'] Literal):not(CallExpression[callee.object.name=\'logger\'] Literal)',
          message: 'Texto em português no código. O idioma-fonte é o inglês: crie a chave em src/plugins/messages/ e chame useT(); a tradução vai para o pacote pt-BR.',
        },
        // `<code>action</code>` fica de fora: o conteúdo de `code` é IDENTIFICADOR, e identificador
        // não traduz — pelo mesmo motivo que `record`, `isNew` e `status` não traduzem no resto do
        // código. Sem essa exceção, a alternativa seria dissolver a marcação dentro da frase
        // traduzida e perder a distinção visual entre prosa e símbolo numa dica técnica.
        {
          selector: "JSXElement:not([openingElement.name.name='code']):not([openingElement.name.property.name=/^(Code|Pre|Signature|OpName|ParamName)$/]) > JSXText[value=/[A-Za-zÀ-ÿ]{2}/]",
          message: 'Texto solto no JSX. Todo texto de usuário vem do catálogo: renderize {t(\'chave\')} em vez de escrever a frase. Nome próprio (marca) precisa de eslint-disable-next-line com justificativa.',
        },
        // O MESMO texto solto, quando ele está dentro de chaves em vez de escrito direto no JSX.
        // `{w.enabled ? 'Habilitado' : 'Desabilitado'}` atravessou a zona inteira: não é `JSXText`,
        // não é atributo, e as duas palavras não têm acento — as três regras acima passavam por ele.
        // Era a badge da lista de automações, em português, na zona dada como migrada.
        //
        // Só FILHO de elemento conta. Valor de atributo fica de fora porque ali o literal é quase
        // sempre enum técnico (`variant={x ? 'danger' : 'default'}`, `type={n ? 'number' : 'text'}`),
        // que não traduz — e o texto de atributo já é cobrado pela regra dos nomes de atributo.
        {
          selector: 'JSXElement > JSXExpressionContainer > Literal[value=/[A-Za-zÀ-ÿ]{2}/], JSXElement > JSXExpressionContainer > ConditionalExpression > Literal[value=/[A-Za-zÀ-ÿ]{2}/], JSXElement > JSXExpressionContainer > LogicalExpression > Literal[value=/[A-Za-zÀ-ÿ]{2}/], JSXFragment > JSXExpressionContainer > Literal[value=/[A-Za-zÀ-ÿ]{2}/], JSXFragment > JSXExpressionContainer > ConditionalExpression > Literal[value=/[A-Za-zÀ-ÿ]{2}/], JSXFragment > JSXExpressionContainer > LogicalExpression > Literal[value=/[A-Za-zÀ-ÿ]{2}/]',
          message: 'Texto de usuário como literal dentro de chaves no JSX. Renderize {t(\'chave\')}: o que se lê na tela vem do catálogo, e o ternário escolhe a CHAVE, não a frase.',
        },
        {
          selector: 'JSXFragment > JSXText[value=/[A-Za-zÀ-ÿ]{2}/]',
          message: 'Texto solto no JSX. Todo texto de usuário vem do catálogo: renderize {t(\'chave\')} em vez de escrever a frase.',
        },
        {
          selector: "JSXAttribute[name.name=/^(title|label|placeholder|message|subtitle|description|hint|summary|alt|aria-label|confirmLabel|cancelLabel|runLabel|emptyMessage|emptyTitle|emptyActionLabel|newTitle|newLabel|filterPlaceholder|deleteConfirmTitle|deleteConfirmMessage)$/] > Literal[value=/[A-Za-zÀ-ÿ]{2}/]",
          message: 'Texto de usuário como literal num atributo. Passe {t(\'chave\')}: o atributo é lido por quem usa o sistema, então ele traduz.',
        },
        // `newTitle`, `emptyTitle`, `emptyActionLabel` e `filterPlaceholder` entraram DEPOIS, e o motivo
        // é o de sempre: a lista era de nomes vistos, não de nomes possíveis. `newTitle={`Novo
        // ${titleSingular}`}` atravessou a zona inteira porque "Novo" não tem acento e o nome do
        // atributo não estava aqui — quatro frases em português na tela de todo registro do sistema.
        //
        // O filho DIRETO do atributo é o container da expressão, então a frase pode estar em
        // qualquer forma dentro dele: `cond ? 'A' : 'B'`, `valor || 'padrão'`, `valor ?? 'padrão'`.
        // Enumerar as formas já falhou duas vezes — o ternário deixou passar "Novo Campo", e o `||`
        // deixou passar "ex: avisar-cliente". A regra passa a olhar QUALQUER literal descendente.
        //
        // O que a mantém fora de `{t('chave')}` é o CONTEXTO, não o formato do valor: literal que
        // é argumento de CHAMADA está sendo usado como chave, não renderizado. Isso cobre também
        // `{t(cond ? 'chave.a' : 'chave.b')}`, onde o literal não é filho direto da chamada.
        //
        // Filtrar por formato ("parece chave") seria o caminho óbvio e não funciona: a esquery
        // encerra a regex do seletor na primeira `/`, mesmo dentro de classe de caracteres, e
        // `core.ui/action.save` deixaria de ser reconhecida como chave.
        {
          selector: "JSXAttribute[name.name=/^(title|label|placeholder|message|subtitle|description|hint|summary|alt|aria-label|confirmLabel|cancelLabel|runLabel|emptyMessage|emptyTitle|emptyActionLabel|newTitle|newLabel|filterPlaceholder|deleteConfirmTitle|deleteConfirmMessage)$/] > JSXExpressionContainer Literal[value=/[A-Za-zÀ-ÿ]{2}/]:not(CallExpression Literal)",
          message: 'Texto de usuário dentro de uma expressão no atributo. Traduza a CHAVE, não a frase: {t(cond ? \'chave.a\' : \'chave.b\')} ou {valor || t(\'chave\')}.',
        },
        // `{ label: 'Executar um fluxo de trabalho' }` escapava de tudo: não é JSX, e a frase não
        // tem acento. Propriedade que CARREGA texto de usuário é tão lida quanto um atributo JSX —
        // e um mapa de opções é exatamente onde a frase costuma se esconder.
        {
          selector: "Property[key.name=/^(label|title|subtitle|description|message|placeholder|hint|summary|meta)$/] > Literal[value=/[A-Za-zÀ-ÿ]{2}/][value!=/^(@|[a-z][a-z0-9.-]*$)/]",
          message: 'Texto de usuário como literal numa propriedade. Passe t(\'chave\'): a propriedade é lida por quem usa o sistema, então ela traduz.',
        },
        // `name` DENTRO de um manifest de plugin. Fora dele a propriedade é IDENTIFICADOR — nome de
        // função de expressão, símbolo de operador, chave de provedor —, e vigiá-la só daria ruído;
        // dentro dele ela é o rótulo do plugin, do ponto de extensão ou da contribuição. Foi por
        // esta porta que os NOVE nomes de Step em português atravessaram a migração inteira: o
        // catálogo já tinha as onze chaves, o manifest continuava dizendo "Buscar Registros", e
        // nenhum dos nove tem acento para o gatilho ver. O metadado que comprovadamente não é
        // renderizado se declara com um `eslint-disable-next-line` e a razão, como o `description`
        // ao lado já faz. `publisher.name` fica de fora: editora é marca, e marca não se traduz.
        {
          selector: "Property[key.name='manifest'] Property[key.name='name'] > Literal[value=/[A-Za-zÀ-ÿ]{2}/][value!=/^(@|[a-z][a-z0-9.-]*$)/]:not(Property[key.name='publisher'] Literal)",
          message: 'Nome de plugin, ponto ou contribuição como literal. Passe a referência \'@namespace/chave\': o manifest é declarativo, e quem o lê traduz.',
        },
        // A MESMA propriedade, quando o valor é template literal. Sem isto, `message: \`Objeto
        // "${name}" montado\`` passava: o gatilho por acento não vê "Objeto montado", e o seletor
        // acima só olha `Literal`. Foi assim que duas mensagens de Step atravessaram a migração.
        {
          selector: "Property[key.name=/^(label|title|subtitle|description|message|placeholder|hint|summary)$/] > TemplateLiteral > TemplateElement[value.raw=/[A-Za-zÀ-ÿ]{2}/]",
          message: 'Texto de usuário num template literal de propriedade. Passe t(\'chave\', { param }) com interpolação {param}.',
        },
        // `notify('Erro ao mover step.')` era a maior porta que sobrava: não é JSX, não é atributo e
        // não é propriedade — e nenhuma das dezessete frases que passaram por ela tinha acento. O que
        // um `notify` legítimo carrega como literal é a VARIANTE, e ela é enumerável; qualquer outro
        // literal ali é a frase que o usuário lê.
        {
          selector: "CallExpression[callee.name='notify'] > Literal[value=/[A-Za-zÀ-ÿ]{2}/][value!=/^(error|success|warning|info)$/]",
          message: 'Texto de usuário como literal num notify(). Passe notify(t(\'chave\'), \'error\'): a notificação é lida por quem usa o sistema, então ela traduz.',
        },
        {
          selector: "CallExpression[callee.name='notify'] > TemplateLiteral > TemplateElement[value.raw=/[A-Za-zÀ-ÿ]{2}/]",
          message: 'Texto de usuário num template literal de notify(). Passe notify(t(\'chave\', { param }), \'error\') com interpolação {param}.',
        },
        {
          selector: 'TemplateElement[value.raw=/[áàâãéêíóôõúüçÁÀÂÃÉÊÍÓÔÕÚÜÇ]/]:not(CallExpression[callee.object.name=\'console\'] TemplateElement):not(CallExpression[callee.object.property.name=\'logger\'] TemplateElement):not(CallExpression[callee.object.name=\'logger\'] TemplateElement)',
          message: 'Texto em português em template literal. O idioma-fonte é o inglês: use t(\'chave\', { param }) com interpolação {param}.',
        },
      ],
    },
  },
])
