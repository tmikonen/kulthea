import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadContent, type LoadResult } from '../../plugin/load-content';

export const FIXTURES = path.resolve(__dirname, '../fixtures');

const tempDirs: string[] = [];

export function cleanupTempContent() {
  for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
}

/** Copies the fixture content to a temp folder, lets the test change it, and loads it. */
export function loadModified(change: (dir: string) => void): LoadResult {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kulthea-content-'));
  tempDirs.push(dir);
  fs.cpSync(FIXTURES, dir, { recursive: true });
  change(dir);
  return loadContent(dir);
}

export function editJson(dir: string, name: string, edit: (data: any) => void) { // eslint-disable-line @typescript-eslint/no-explicit-any
  const file = path.join(dir, name);
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  edit(data);
  fs.writeFileSync(file, JSON.stringify(data));
}
