import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    coverage: {
      provider: 'istanbul',
      reporter: ['text', 'html'],
      statements: 60,
      branches: 60,
      functions: 60,
      lines: 60,
    },
  },
});
