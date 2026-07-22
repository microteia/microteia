import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

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
])
