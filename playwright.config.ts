import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  // Run tests in files sequentially to avoid profile locking issues with persistent context
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // Single worker avoids database/profile lock errors during chrome profile initialization
  workers: 1,
  reporter: 'list',
  use: {
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      testIgnore: '**/engine/**',
      use: { ...devices['Desktop Chrome'] },
    },
    // Engine unit tests: plain about:blank page, no extension loaded.
    // Needs a real browser — isVisible() reads layout, which jsdom cannot provide.
    {
      name: 'engine',
      testDir: './tests/engine',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
