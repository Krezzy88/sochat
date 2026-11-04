import { defineConfig, devices } from '@playwright/test';
import base from './playwright.config.ts';
export default defineConfig({
  ...base,
  projects: [
    {
      name: 'webkit-desktop',
      use: { ...devices['Desktop Safari'], browserName: 'webkit' },
    },
    {
      name: 'webkit-mobile',
      use: { ...devices['iPhone 13'], browserName: 'webkit' },
    },
  ],
});
