# Short instruction for develompent

## Create an admin secret

Authentication in this application is (currently?) very simple. When someone visits a page, they need to provide a token URL parameter.
There are three types of tokens:

- admin token: This is set as an environment variable. The Admin can create projects
- project tokens: read and edit tokens for working with projects. These are stored in the projects DB table
- reviewer tokens: tokens for authenticating invited users. These are stored in the reviewers DB table

To get started you'll need to set an ADMIN_TOKEN in a .env.local file

```bash
ADMIN_TOKEN='super secret token'
```

Note that the token needs to be a proper cryptographic secret, so it cannot be guessed by brute forcing. You can get one with:

```bash
npm run admintoken
```

## Development database

For local development you can use a regular ol' postgres db.
Easiest way is to spin up a docker:

```bash
docker run --name postgres -e POSTGRES_USER="devuser" -e POSTGRES_PASSWORD="devpw" -p 5432:5432 -d postgres
```

Use the DATABASE_URL environment variable

```bash
DATABASE_URL=postgresql://devuser:devpw@localhost:5432/paperbidding
```

## Running development server

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

For checking typescript errors without having to build, run

```bash
npm run watch
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Deploying

This application is designed for serverless deployment using [Vercel](https://vercel.com/) and [Neon](https://neon.tech/)

On Vercel you can easily deploy this application from a GitHub repository (just fork it first). The free tier should be sufficient.

You can create a DB at NEON (the free tier should be sufficient) and then set the DB url in .env.local (or otherwise in the environment variables on Vercel). Note that here you need to use NEON_DATABASE_URL (not DATABASE_URL)

```bash
NEON_DATABASE_URL=[Neon DB URL]
```
