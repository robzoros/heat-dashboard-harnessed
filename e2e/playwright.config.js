import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

// Ruta de Chromium del entorno original (Linux). Si no existe (p. ej. Windows),
// se usa el navegador instalado por Playwright (~/AppData/Local/ms-playwright).
const linuxChromium = '/snap/chromium/current/usr/lib/chromium-browser/chrome';
const systemChromium = existsSync(linuxChromium) ? linuxChromium : undefined;

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: '../evidence/reports', open: 'never' }]
  ],
  use: {
    baseURL: 'http://localhost:8082',
    viewport: { width: 1280, height: 900 },
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...(process.env.CI ? {} : { launchOptions: systemChromium ? { executablePath: systemChromium, args: ['--no-sandbox'] } : { args: ['--no-sandbox'] } }),
      },
    },
  ],
});
