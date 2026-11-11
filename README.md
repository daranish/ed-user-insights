# ED User Insights: clickable prototype (Everyday Goods)

A front-end-only prototype of the internal app that connects a research question to participants, sessions, evidence, findings and actions. All data is synthetic. Anything that stands in for a real integration carries a purple **SIMULATED** badge. Open **About this prototype** in the app for what is implemented, what is simulated and what is out of scope.

## Run

```
npm install
npm run dev       # http://localhost:5173
npm test          # Vitest: coverage, confidence guardrails, evidence display, PII, related findings
npm run build     # type-check + production build to dist/
npm run preview   # serve dist/ on http://localhost:4173
npm run lint      # oxlint
```

## Stack

Vite, React 19, TypeScript (strict), Tailwind CSS v4, react-router (HashRouter), Zustand. UI components come from Layro and live in `src/components/ui/`; don't edit them. The theme is restyled by overriding Layro's CSS variables in `src/index.css`.

## Where things are

- `src/lib/types.ts`: the domain model.
- `src/fixtures/*.json`: the synthetic seed data, typed in `src/fixtures/index.ts`. The demo CSV is in that file too.
- `src/lib/store.ts`: the simulated backend. It keeps state in memory, mirrors it to localStorage, adds 300–800 ms of latency, and supports forced failures.
- `src/lib/rules/`: the business rules as pure functions (coverage, confidence, PII, search, metrics), plus their tests.
- `src/lib/permissions.ts`: what each role may do, with a reason when it may not.
- `src/pages/`: one file per screen. The question workspace tabs are in `pages/question/`, the admin screens in `pages/admin/`.

The demo date is fixed at 12 Nov 2026 (`src/lib/time.ts`), so overdue items stay the same for every reviewer. **Demo controls** (top bar) force API errors, an edit conflict, an import failure and "recording unavailable", and also reset the demo data.

## Deploy (static)

`dist/` is plain static files. HashRouter and `base: './'` mean no rewrite rules are needed.

**Vercel**

```
npm i -g vercel
vercel login
vercel --prod           # run inside app/; accept the detected Vite settings (build: npm run build, output: dist)
```

**Firebase Hosting** (uses `firebase.json` in this folder)

```
npm i -g firebase-tools
firebase login
npm run build
firebase projects:create customer-learning-proto-<suffix>   # or use an existing project
firebase deploy --only hosting --project customer-learning-proto-<suffix>
```

Both print a public URL you can share.
