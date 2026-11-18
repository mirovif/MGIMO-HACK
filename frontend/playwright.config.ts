import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  workers: 1,
  use: {
    baseURL: process.env.CAMPUS_TEST_URL || 'http://127.0.0.1:3000',
    browserName: 'chromium',
    launchOptions: process.env.CAMPUS_CHROMIUM ? { executablePath: process.env.CAMPUS_CHROMIUM } : undefined,
  },
})
