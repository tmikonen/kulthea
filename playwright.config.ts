import { defineConfig } from '@playwright/test';

const port = 4173;

export default defineConfig({
  testDir: 'tests/e2e',
  use: { baseURL: `http://localhost:${port}/kulthea/` },
  webServer: {
    command: `npm run build -- --outDir dist-e2e && npm run preview -- --outDir dist-e2e --port ${port} --strictPort`,
    url: `http://localhost:${port}/kulthea/`,
    env: { CONTENT_DIR: 'tests/fixtures' },
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
