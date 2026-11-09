import { defineConfig } from '@playwright/test'

// Browser smoke test: runs against the production build served by `vite preview`.
// Locally: `npm run test:e2e`. Set PW_CHROMIUM_PATH to use an already-installed Chromium.
const executablePath = process.env.PW_CHROMIUM_PATH || undefined

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4173/',
    trace: 'off',
    launchOptions: { executablePath },
  },
  projects: [
    { name: 'phone-390', use: { viewport: { width: 390, height: 844 }, hasTouch: true } },
    { name: 'desktop-1280', use: { viewport: { width: 1280, height: 800 } } },
  ],
  webServer: {
    command: 'npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173/',
    reuseExistingServer: false, // always test the build just made, never a stale server
  },
})
