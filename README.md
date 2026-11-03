# Conference planner

Match reviewers to submissions for a conference, with or without paper
bidding. Bidding is optional: matching also works on automatic similarity
alone (between the submissions and the reviewers' own work).

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/kasperwelbers/PaperBidding/tree/conference-planner)

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
  institutions/           university list (email domains) and resolver
wrangler.jsonc            Cloudflare config for the whole repo (one Worker)
```

## Development

Requires Node 22+ and pnpm.

```bash
pnpm install
cp .dev.vars.example .dev.vars                     # local secrets
pnpm db:migrate:local                              # create the local D1 database
pnpm dev                                           # API on :8787, web app on :5180
```

Open http://localhost:5180. The web dev server sends `/api` to the API. Sign
in with the email you set as `SUPERADMIN` in `.dev.vars`. In development the
sign-in code is printed in the API's terminal output instead of emailed.

`pnpm dev` runs the API with `wrangler dev --local` and the development
settings (see `apps/api/package.json`). Everything (D1, R2, Queues) is
simulated locally, so you don't need a Cloudflare account.

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
neurons per day; computing the embeddings of a whole conference costs cents).
The free plan might work, but at your own risk.

### With the button

Click **Deploy to Cloudflare** at the top. Cloudflare copies this repository to
your GitHub or GitLab account, creates the database (D1), file storage (R2) and
queue, and asks for the secrets (see below). Later changes to your copy are
deployed automatically.

### By hand

`wrangler.jsonc` describes everything the app needs. On the first deploy,
Wrangler creates the database, file storage and queue itself (the config has
no resource IDs), and writes their IDs into `wrangler.jsonc`: commit that
change.

```bash
pnpm install
pnpm exec wrangler login
pnpm exec wrangler secret put SUPERADMIN          # comma-separated emails
pnpm exec wrangler secret put BETTER_AUTH_SECRET  # openssl rand -base64 32
pnpm run deploy                                   # build, migrate, deploy
```

`pnpm run deploy` is also how you deploy updates: it applies new database
migrations, then deploys the code.

### Settings and secrets

- **Secrets** (`.dev.vars.example`): `SUPERADMIN` and `BETTER_AUTH_SECRET`.
  Later, once email is set up: `SCW_SECRET_KEY` and `SCW_PROJECT_ID` (see
  Email). Until then the app works, but can't send sign-in codes.
- **Settings** (`vars` in `wrangler.jsonc`, also editable in the Cloudflare
  dashboard):
  - `EMAIL_PROVIDER`: `scaleway` (default) or `cloudflare` (see Email)
  - `EMAIL_FROM`: the sender, on your verified domain
  - `SCW_REGION`
  - `BETTER_AUTH_URL`: only needed with a custom domain; empty means the
    address the app is visited on
  - leave `ENVIRONMENT` and `EMBEDDINGS` as they are

### Embeddings

Similarity between submissions uses Workers AI. Per conference you choose the
language of the submissions:

- **English:** `@cf/baai/bge-base-en-v1.5`
- **Multilingual:** `@cf/baai/bge-m3`, 100+ languages

Changing the model means computing the embeddings again (per edition:
"Compute missing embeddings").

### Email

The app only sends **sign-in codes**: email that the user requests. It sends
no invitations or other bulk email: planners share their division's link
through their own channels (e.g. a ScholarOne mass email or a mailing list).

- **Scaleway Transactional Email** (default, `EMAIL_PROVIDER=scaleway`, with
  the `SCW_*` secrets): an established service with known limits, hosted in
  the EU.
- **Cloudflare Email Service** (`EMAIL_PROVIDER=cloudflare`): no extra account
  or keys. But it is in beta, and new accounts start with an undisclosed,
  conservative daily quota that grows with use. The risky moment is right
  after planners share their links, when many reviewers request a code on the
  same day. If you use it, request a higher limit in advance.

**Setting up email** doesn't depend on the app: the sending domain is any
domain whose DNS you manage (it doesn't have to point to the app).

1. In Scaleway, add your domain to Transactional Email, and add the DNS records
   it shows (SPF, DKIM, DMARC) where the domain's DNS is managed.
2. Once Scaleway has verified the domain, create an API key.
3. In the Cloudflare dashboard (your Worker → Settings → Variables and
   Secrets), add the secrets `SCW_SECRET_KEY` and `SCW_PROJECT_ID`, and set
   `EMAIL_FROM` to an address on that domain.

Without verified SPF, DKIM and DMARC records, your emails end up in spam. In local development,
sign-in codes are printed to the console instead.
