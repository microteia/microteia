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
  'src/presentation/shared/screenIcons.tsx',
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
      // Comentário de CSS vive DENTRO do template literal, e comentário continua em português. Num
      // arquivo de estilo não há texto de usuário para proteger, então ele fica fora da zona.
      '**/*.styles.tsx',
    ],
    rules: {
      'no-restricted-syntax': ['error',
        {
          selector: 'Literal[value=/[áàâãéêíóôõúüçÁÀÂÃÉÊÍÓÔÕÚÜÇ]/]',
          message: 'Texto em português no código. O idioma-fonte é o inglês: crie a chave em src/plugins/messages/ e chame useT(); a tradução vai para o pacote pt-BR.',
        },
        {
          selector: 'JSXText[value=/[A-Za-zÀ-ÿ]{2}/]',
          message: 'Texto solto no JSX. Todo texto de usuário vem do catálogo: renderize {t(\'chave\')} em vez de escrever a frase. Nome próprio (marca) precisa de eslint-disable-next-line com justificativa.',
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
        {
          selector: 'TemplateElement[value.raw=/[áàâãéêíóôõúüçÁÀÂÃÉÊÍÓÔÕÚÜÇ]/]',
          message: 'Texto em português em template literal. O idioma-fonte é o inglês: use t(\'chave\', { param }) com interpolação {param}.',
        },
      ],
    },
  },
])
