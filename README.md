This is a [Next.js](https://nextjs.org/) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Redis

This application uses Redis for storage. For development, the easiest way is to run it locally using docker.

```bash
docker run -p 6379:6379 -it redis/redis-stack-server:latest
```

For production, we recommend signing up for Upstash for the "Pay as you go" tier. Then create a .env.local file to specify the DATABASE_URL

```bash
DATABASE_URL=...
```
