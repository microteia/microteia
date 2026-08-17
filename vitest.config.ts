import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'functions/**/*.test.ts', 'scripts/**/*.test.ts', 'cli/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/domain/services/**', 'functions/src/**'],
      thresholds: { lines: 80, functions: 80, branches: 80 },
    },
  },
});
