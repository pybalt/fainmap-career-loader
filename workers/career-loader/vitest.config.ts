/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'miniflare',
    environmentOptions: {
      modules: true,
      scriptPath: 'src/index.ts',
      wranglerConfigPath: './wrangler.toml',
      bindings: {}
    },
    globals: true,
    setupFiles: ['./src/setupTests.ts']
  }
}); 