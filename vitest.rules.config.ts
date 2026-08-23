import { defineConfig } from 'vitest/config';

/**
 * A suíte das Security Rules corre SEPARADA do `npm test`, e não por capricho: ela precisa do
 * emulador do Firestore, que precisa de um JDK. Quem só quer rodar os testes de unidade não deve ser
 * obrigado a instalar Java — e um teste que não roda na máquina de quem o herda vira ruído até
 * alguém apagá-lo.
 *
 * `npm run test:rules` sobe o emulador, roda esta configuração e o derruba.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['rules-tests/**/*.test.ts'],
    // Uma regra é avaliada contra um emulador de verdade: o custo é de rede, não de CPU, e paralelizar
    // arquivos sobre a mesma instância só produz interferência entre eles.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
