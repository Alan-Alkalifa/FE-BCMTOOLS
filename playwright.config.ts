import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
    ...devices['Desktop Chrome'],
  },
  projects: [
    // API mocked in the browser: runs against the frontend alone.
    { name: 'ui', testDir: './e2e/ui' },
    // Real backend: runs against a full local stack or a deployed environment.
    { name: 'smoke', testDir: './e2e/smoke' },
  ],
})
