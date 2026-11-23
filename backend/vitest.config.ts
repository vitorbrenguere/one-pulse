import { defineConfig } from 'vitest/config';
import { loadTestEnvVars } from './tests/setup/test-env-vars.js';

export default defineConfig({
  test: {
    env: loadTestEnvVars(),
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['src/**/*.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.test.ts'],
          globalSetup: ['tests/setup/global-setup.ts'],
          // Os arquivos compartilham o mesmo banco: rodam em série para não haver
          // interferência entre os resets do banco.
          fileParallelism: false,
          testTimeout: 15_000,
          hookTimeout: 30_000,
        },
      },
    ],
  },
});
