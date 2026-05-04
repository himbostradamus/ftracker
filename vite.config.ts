import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

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

export default defineConfig({
  base: resolveBase(),
  plugins: [react(), tailwindcss()],
  server: {
    // HMR is disabled in AI Studio via DISABLE_HMR env var.
    hmr: process.env.DISABLE_HMR !== 'true',
  },
});
