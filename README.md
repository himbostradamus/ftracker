# Training Tracker

A minimalist mobile-first workout, progress, and macro tracker. All data lives in the browser's `localStorage`; nothing is sent to any server.

## Run locally

Requires Node.js 20+.

```bash
npm install
npm run dev
```

The dev server runs at http://localhost:3000.

## Scripts

- `npm run dev` — Vite dev server with HMR
- `npm run build` — production bundle into `dist/`
- `npm run preview` — preview the production bundle locally
- `npm run lint` — type-check with `tsc --noEmit`

## Deploying to GitHub Pages

A workflow at `.github/workflows/deploy.yml` builds on every push to `main` and publishes the `dist/` folder to Pages.

One-time setup:

1. Push the repo to GitHub.
2. In the repo, go to **Settings → Pages → Build and deployment** and set **Source** to **GitHub Actions**.
3. Push to `main`. The first run will build and deploy; subsequent pushes redeploy automatically.

The site will be available at `https://<user>.github.io/<repo>/`.

### How the base path works

`vite.config.ts` derives the asset base path automatically:

- In CI, it reads the `GITHUB_REPOSITORY` env var that Actions sets and produces `/<repo>/`.
- If the repo is named `<user>.github.io` (a user/org page served at the apex), it uses `/`.
- Locally (`dev`, `preview`), it falls back to `/`.

You can override with `BASE_PATH=/whatever/ npm run build`.

### Custom domain

If you point a custom apex domain at the Pages site:

1. Add a `CNAME` file under `public/` containing the domain (Vite copies `public/` verbatim into `dist/`).
2. Set `BASE_PATH: /` in the workflow's build env so assets resolve at the root.
