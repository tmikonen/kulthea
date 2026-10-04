import { defineConfig } from '@playwright/test';

// Two sites are built from fixtures: the ordinary one, and one whose main map has a focus zoom.
const port = 4173;
const focusPort = 4174;

const site = (outDir: string, content: string, sitePort: number) => ({
  command: `npm run build -- --outDir ${outDir} && npm run preview -- --outDir ${outDir} --port ${sitePort} --strictPort`,
  url: `http://localhost:${sitePort}/kulthea/`,
  env: { CONTENT_DIR: content },
  reuseExistingServer: false,
  timeout: 120_000,
});

export default defineConfig({
  testDir: 'tests/e2e',
  projects: [
    { name: 'fixtures', testIgnore: /focus\.spec\.ts/, use: { baseURL: `http://localhost:${port}/kulthea/` } },
    { name: 'focus', testMatch: /focus\.spec\.ts/, use: { baseURL: `http://localhost:${focusPort}/kulthea/` } },
  ],
  webServer: [
    site('dist-e2e', 'tests/fixtures', port),
    site('dist-e2e-focus', 'tests/fixtures-focus', focusPort),
  ],
});
