# Conference planner

Match reviewers to submissions for a conference, with or without paper
bidding. Bidding is optional: matching also works on automatic similarity
alone (between the submissions and the reviewers' own work).

This is the successor of PaperBidding and is under construction. See
[`docs/conference-planner/plan.md`](docs/conference-planner/plan.md) for the
plan. The current PaperBidding app (Next.js) is in [`legacy/`](legacy/) for
reference while porting. It's maintained on the `main` branch.

## Structure

```
apps/
  web/                    Vite + React SPA
  api/                    Hono API on Cloudflare Workers (also serves the SPA)
packages/
  shared/                 types, platform adapter interface, similarity
  db/                     D1 (sqlite) schema and migrations (drizzle)
  adapter-scholarone/     ScholarOne adapter and presets (ICA)
```

## Development

Requires Node 22+ and pnpm.

```bash
pnpm install
cp apps/api/.dev.vars.example apps/api/.dev.vars   # local secrets
pnpm db:migrate:local                              # create the local D1 database
pnpm dev                                           # API on :8787, web app on :5173
```

Open http://localhost:5173. The web dev server sends `/api` to the API.

`pnpm dev` runs the API with `wrangler dev --local`. Everything (D1, R2,
Queues) is simulated locally, so you don't need a Cloudflare account. The one
exception is Workers AI, which only runs on Cloudflare, so embeddings are not
available in local development.

Other commands:

```bash
pnpm typecheck
pnpm test
pnpm db:generate     # after changing packages/db/src/schema.ts: create a migration
```

Database changes are always made through migrations. Change the schema, run
`pnpm db:generate`, and commit the generated SQL in `packages/db/migrations`.

## Hosting (Cloudflare)

We recommend the **Workers Paid plan** ($5/month). It includes enough compute
and storage for a conference, plus Workers AI for the embeddings (10,000 free
neurons per day, then $0.011 per 1,000 neurons). The free plan might work, but
at your own risk.

First deploy:

```bash
cd apps/api
pnpm exec wrangler login
pnpm exec wrangler d1 create conference-planner        # put the id in wrangler.jsonc
pnpm exec wrangler r2 bucket create conference-planner-files
pnpm exec wrangler queues create conference-planner-imports
pnpm exec wrangler secret put SUPERADMIN
```

Every deploy, from the repository root (migrations first, then code):

```bash
pnpm --filter @cp/api db:migrate:remote
pnpm deploy
```

### Email

Sign-in codes and invitations are sent by email, through Scaleway
Transactional Email (not set up yet). **Set up email properly**: use a verified
sending domain with SPF, DKIM and DMARC records, or your emails will end up in
spam. In local development, sign-in codes are printed to the console instead.
