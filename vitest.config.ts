import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./apps/web/src', import.meta.url)),
      'server-only': fileURLToPath(new URL('./apps/web/tests/__mocks__/server-only.ts', import.meta.url)),
      'next/headers': fileURLToPath(new URL('./apps/web/tests/__mocks__/next-headers.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['apps/**/*.test.ts', 'packages/**/*.test.ts'],
    coverage: {
      enabled: false,
    },
  },
});
