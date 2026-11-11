import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

// Derive the GitHub Pages base path automatically.
//
// Resolution order:
//   1. BASE_PATH env var (manual override; e.g. `BASE_PATH=/foo/ npm run build`).
//   2. GITHUB_REPOSITORY env var (set by GitHub Actions: "user/repo-name").
//      If the repo name is `<user>.github.io` the site is served at the domain
//      root, so we use '/'. Otherwise it's a project page at /<repo>/.
//   3. '/' (dev server, `npm run preview`, custom domain at the apex).
//
// If you switch to a custom apex domain later, no change is needed: the
// GitHub Action build will still emit /<repo>/, but the deployed Pages site
// uses a CNAME, so set BASE_PATH=/ in the workflow if that becomes an issue.
function resolveBase(): string {
  if (process.env.BASE_PATH) return process.env.BASE_PATH;
  const repoFull = process.env.GITHUB_REPOSITORY; // "owner/name"
  if (repoFull) {
    const name = repoFull.split('/')[1] ?? '';
    if (name && !/\.github\.io$/i.test(name)) {
      return `/${name}/`;
    }
  }
  return '/';
}

// After the build, write the list of emitted files into the service worker so
// the whole app (shell, catalog, illustrations) is cached for offline use.
function precache(): Plugin {
  let outDir = 'dist';
  return {
    name: 'precache-manifest',
    apply: 'build',
    configResolved(c) { outDir = c.build.outDir; },
    closeBundle() {
      const walk = (dir: string): string[] => readdirSync(dir).flatMap(f => {
        const p = join(dir, f);
        return statSync(p).isDirectory() ? walk(p) : [p];
      });
      const files = walk(outDir).map(f => relative(outDir, f).split('\\').join('/')).filter(f => f !== 'sw.js').sort();
      const hash = createHash('sha1');
      for (const f of files) hash.update(f).update(readFileSync(join(outDir, f)));
      const swPath = join(outDir, 'sw.js');
      const sw = readFileSync(swPath, 'utf8')
        .replace('__PRECACHE__', JSON.stringify(files))
        .replace('__VERSION__', hash.digest('hex').slice(0, 12));
      writeFileSync(swPath, sw);
    },
  };
}

export default defineConfig({
  base: resolveBase(),
  plugins: [react(), tailwindcss(), precache()],
  server: {
    // HMR is disabled in AI Studio via DISABLE_HMR env var.
    hmr: process.env.DISABLE_HMR !== 'true',
  },
});
