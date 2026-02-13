import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: 'http://127.0.0.1:8080',
    headless: true,
  },
  webServer: {
    command: 'cd ../backend && ./md-office',
    port: 8080,
    reuseExistingServer: true,
    timeout: 15_000,
  },
});
