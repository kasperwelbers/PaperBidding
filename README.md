# How to setup

## Develop

First start up a local database. Easiest is to use Postgres in Docker.

```bash
docker run --name postgres -e POSTGRES_USER="devuser" -e POSTGRES_PASSWORD="devpw" -p 5432:5432 -d postgres`
```

Then create a database called `paperbidding` in that database.

```bash
docker exec -it postgres psql -U devuser -c "CREATE DATABASE paperbidding;"
```

Now you'll need to set up your environment variables in a `.env.local` file.
To get the NEXTAUTH_SECRET you can run `npm run secret`, or use `openssl rand -base64 32`.
For the RESEND_API_KEY you'll need an account at `https://resend.com`.

```bash
SUPERADMIN="kasperwelbers@gmail.com"
DATABASE_URL="postgresql://devuser:devpw@localhost:5432/paperbidding"
RESEND_API_KEY="..."
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="a cryptographic secret"
```

## Deploy

Easiest to host it on Vercel, and use NEON for the database.
On Vercel the environment variables almost the same as dev,
except that you need to use `NEON_DATABASE_URL` instead of `DATABASE_URL`,
and you set NEXTAUTH_URL to the URL of your Vercel deployment.

```bash
SUPERADMIN="kasperwelbers@gmail.com"
NEON_DATABASE_URL="provided by NEON"
RESEND_API_KEY="..."
NEXTAUTH_URL="https://paperbidding.ica-cm.com"
NEXTAUTH_SECRET="a cryptographic secret"
```
