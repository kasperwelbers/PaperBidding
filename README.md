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
To get the BETTER_AUTH_SECRET you can run `npm run secret`, or use `openssl rand -base64 32`.
For the RESEND_API_KEY you'll need an account at `https://resend.com`.
If RESEND_API_KEY is not set in development, sign-in codes are printed to the server console instead.

Note that BETTER_AUTH_SECRET is also used to create the secret bidding links,
so changing it breaks all existing bidding links. (This variable used to be called NEXTAUTH_SECRET; keep the same value.)

```bash
SUPERADMIN="kasperwelbers@gmail.com"
DATABASE_URL="postgresql://devuser:devpw@localhost:5432/paperbidding"
RESEND_API_KEY="..."
BETTER_AUTH_URL="http://localhost:3000"
BETTER_AUTH_SECRET="a cryptographic secret"
```

## Deploy

Easiest to host it on Vercel, and use NEON for the database.
On Vercel the environment variables almost the same as dev,
except that you need to use `NEON_DATABASE_URL` instead of `DATABASE_URL`,
and you set BETTER_AUTH_URL to the URL of your Vercel deployment.

```bash
SUPERADMIN="kasperwelbers@gmail.com"
NEON_DATABASE_URL="provided by NEON"
RESEND_API_KEY="..."
BETTER_AUTH_URL="https://paperbidding.ica-cm.com"
BETTER_AUTH_SECRET="a cryptographic secret"
```
