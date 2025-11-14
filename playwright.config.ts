import { defineConfig } from '@playwright/test';

const baseURL = process.env.BASE_URL || 'http://localhost:5173';

export default defineConfig({
  testDir: 'tests',
  use: {
    baseURL,
    headless: true,
  },
  timeout: 60000,
  reporter: [['list']],
});