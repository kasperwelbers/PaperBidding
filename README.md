# How to setup

## Develop

* Local postgres database. You can use docker for this: `docker run --name postgres -e POSTGRES_USER="devuser" -e POSTGRES_PASSWORD="devpw" -p 5432:5432 -d postgres`
* Cryptographic secret for NextAuth (`npm run secret`)
* Resend API key (`https://resend.com`)

Then set the following environment variables in a `.env.local` file:

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
