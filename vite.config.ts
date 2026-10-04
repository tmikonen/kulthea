/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { contentPlugin } from './plugin/content-plugin.ts';

// Unit tests read the fixtures, never the demo content.
const contentDir = process.env.CONTENT_DIR ?? (process.env.VITEST ? 'tests/fixtures' : 'content');

export default defineConfig({
  base: '/kulthea/',
  plugins: [react(), contentPlugin({ dir: contentDir })],
  // Map images are always emitted as files, never inlined as data URIs, however small they are.
  build: { assetsInlineLimit: 0 },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['tests/setup.ts'],
    include: ['tests/unit/**/*.test.{ts,tsx}'],
    css: { modules: { classNameStrategy: 'non-scoped' } },
  },
});
