import path from 'node:path';
import type { Plugin } from 'vite';
import { loadContent } from './load-content.ts';

const VIRTUAL_ID = 'virtual:content';
const RESOLVED_ID = '\0' + VIRTUAL_ID;

/** Reads the content folder, validates it, and provides it as the module `virtual:content`. */
export function contentPlugin(options: { dir: string }): Plugin {
  let contentDir = '';

  return {
    name: 'kulthea-content',
    configResolved(config) {
      contentDir = path.resolve(config.root, options.dir);
    },
    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_ID;
    },
    load(id) {
      if (id !== RESOLVED_ID) return;
      const { bundle, errors, warnings } = loadContent(contentDir);
      for (const warning of warnings) this.warn(warning);
      if (errors.length > 0) {
        throw new Error(`Content errors:\n${errors.map((e) => `  - ${e}`).join('\n')}`);
      }
      return `export default ${JSON.stringify(bundle)};`;
    },
    configureServer(server) {
      server.watcher.add(contentDir);
      const reload = (file: string) => {
        if (!path.resolve(file).startsWith(contentDir)) return;
        const module = server.moduleGraph.getModuleById(RESOLVED_ID);
        if (module) server.moduleGraph.invalidateModule(module);
        server.ws.send({ type: 'full-reload' });
      };
      server.watcher.on('change', reload);
      server.watcher.on('add', reload);
      server.watcher.on('unlink', reload);
    },
  };
}
