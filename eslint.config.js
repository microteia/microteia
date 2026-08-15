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
  'src/domain/schema/plugin/**/*.{ts,tsx}',
  'src/domain/usecases/plugins/pluginReferences.ts',
  'src/domain/usecases/plugins/packageSerialization.ts',
  'src/kernel/**/*.{ts,tsx}',
  'src/domain/schema/eventCatalog.ts',
  'src/domain/schema/fieldRulePresets.ts',
]

export default defineConfig([
  globalIgnores(['dist', 'functions/lib']),
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
      // As definições de tipo entregues ao autor de extensão (`declare module`) são DOCUMENTAÇÃO DE
      // API, não texto de runtime: viram IntelliSense no editor dele, não passam por catálogo e não
      // têm como ser traduzidas em tempo de execução. Elas devem ir para o inglês — é trabalho
      // pendente, registrado no ARCHITECTURE.md, e não cabia junto da migração de interface.
      'src/presentation/shared/extensions/extensionTypeDefs.ts',
      // Mesma natureza: as definições de tipo que viram IntelliSense para quem escreve um Script.
      'src/presentation/pages/ViewScript/scriptTypeDefs.ts',
      // Comentário de CSS vive DENTRO do template literal, e comentário continua em português. Num
      // arquivo de estilo não há texto de usuário para proteger, então ele fica fora da zona.
      '**/*.styles.tsx',
    ],
    rules: {
      'no-restricted-syntax': ['error',
        // `console.*` fica de fora: é diagnóstico para NÓS, não texto de usuário — mesma natureza
        // do comentário de código, que a regra de idioma mantém em português de propósito.
        {
          selector: 'Literal[value=/[áàâãéêíóôõúüçÁÀÂÃÉÊÍÓÔÕÚÜÇ]/]:not(CallExpression[callee.object.name=\'console\'] Literal)',
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
        {
          selector: 'JSXFragment > JSXText[value=/[A-Za-zÀ-ÿ]{2}/]',
          message: 'Texto solto no JSX. Todo texto de usuário vem do catálogo: renderize {t(\'chave\')} em vez de escrever a frase.',
        },
        {
          selector: "JSXAttribute[name.name=/^(title|label|placeholder|message|subtitle|description|hint|summary|alt|aria-label|confirmLabel|cancelLabel|runLabel|emptyMessage|deleteConfirmTitle|deleteConfirmMessage)$/] > Literal[value=/[A-Za-zÀ-ÿ]{2}/]",
          message: 'Texto de usuário como literal num atributo. Passe {t(\'chave\')}: o atributo é lido por quem usa o sistema, então ele traduz.',
        },
        // `title={cond ? 'A' : 'B'}` escapava do seletor acima, que só olha o filho DIRETO do
        // atributo: ali o filho é o container da expressão, e as frases ficam dentro do ternário.
        // Foi assim que "Novo Campo" sobreviveu à varredura. Restringir a `ConditionalExpression`
        // mantém `title={t('chave')}` fora — lá o literal é argumento de chamada.
        {
          selector: "JSXAttribute[name.name=/^(title|label|placeholder|message|subtitle|description|hint|summary|alt|aria-label|confirmLabel|cancelLabel|runLabel|emptyMessage|deleteConfirmTitle|deleteConfirmMessage)$/] > JSXExpressionContainer > ConditionalExpression > Literal[value=/[A-Za-zÀ-ÿ]{2}/]",
          message: 'Texto de usuário dentro de um ternário no atributo. Traduza a CHAVE, não a frase: {t(cond ? \'chave.a\' : \'chave.b\')}.',
        },
        {
          selector: "JSXAttribute[name.name=/^(title|label|placeholder|message|subtitle|description|hint|summary|alt|aria-label|confirmLabel|cancelLabel|runLabel|emptyMessage|deleteConfirmTitle|deleteConfirmMessage)$/] > JSXExpressionContainer > ConditionalExpression > ConditionalExpression > Literal[value=/[A-Za-zÀ-ÿ]{2}/]",
          message: 'Texto de usuário dentro de um ternário no atributo. Traduza a CHAVE, não a frase: {t(cond ? \'chave.a\' : \'chave.b\')}.',
        },
        // `{ label: 'Executar um fluxo de trabalho' }` escapava de tudo: não é JSX, e a frase não
        // tem acento. Propriedade que CARREGA texto de usuário é tão lida quanto um atributo JSX —
        // e um mapa de opções é exatamente onde a frase costuma se esconder.
        {
          selector: "Property[key.name=/^(label|title|subtitle|description|message|placeholder|hint|summary)$/] > Literal[value=/[A-Za-zÀ-ÿ]{2}/][value!=/^(@|[a-z][a-z0-9.-]*$)/]",
          message: 'Texto de usuário como literal numa propriedade. Passe t(\'chave\'): a propriedade é lida por quem usa o sistema, então ela traduz.',
        },
        {
          selector: 'TemplateElement[value.raw=/[áàâãéêíóôõúüçÁÀÂÃÉÊÍÓÔÕÚÜÇ]/]:not(CallExpression[callee.object.name=\'console\'] TemplateElement)',
          message: 'Texto em português em template literal. O idioma-fonte é o inglês: use t(\'chave\', { param }) com interpolação {param}.',
        },
      ],
    },
  },
])
