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
pnpm dev                                           # API on :8787, web app on :5180
```

Open http://localhost:5180. The web dev server sends `/api` to the API. Sign
in with the email you set as `SUPERADMIN` in `.dev.vars`. In development the
sign-in code is printed in the API's terminal output instead of emailed.

`pnpm dev` runs the API with `wrangler dev --local`. Everything (D1, R2,
Queues) is simulated locally, so you don't need a Cloudflare account.

**Demo data:** as superadmin, click **Load demo conference** on the home page
(development only). It creates a synthetic conference (two editions, four
divisions, submissions and reviewers) through the normal import pipeline.

**Embeddings:** Workers AI only runs on Cloudflare. Locally, `pnpm dev` uses a
stand-in embedder (`dev-hash-384`) that is based on shared words: not as good,
but enough to develop with. For real embeddings, log in with
`pnpm --filter @cp/api exec wrangler login` and run `pnpm dev:remote-ai`.
Every embedding records its model, and embeddings of different models are
never compared. Production refuses the stand-in.

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
pnpm exec wrangler secret put SUPERADMIN          # comma-separated emails
pnpm exec wrangler secret put BETTER_AUTH_SECRET  # openssl rand -base64 32
pnpm exec wrangler secret put BETTER_AUTH_URL     # e.g. https://planner.example.org
pnpm exec wrangler secret put SCW_SECRET_KEY      # Scaleway Transactional Email
pnpm exec wrangler secret put SCW_PROJECT_ID
pnpm exec wrangler secret put SCW_REGION          # e.g. fr-par
pnpm exec wrangler secret put EMAIL_FROM          # e.g. "Conference planner <noreply@example.org>"
```

Every deploy, from the repository root (migrations first, then code):

```bash
pnpm --filter @cp/api db:migrate:remote
pnpm deploy
```

### Email

Sign-in codes and invitations are sent by email, through Scaleway
Transactional Email (`SCW_*` and `EMAIL_FROM` secrets). **Set up email properly**: use a verified
sending domain with SPF, DKIM and DMARC records, or your emails will end up in
spam. In local development, sign-in codes are printed to the console instead.
