# SpendGuard

AI Agent spending control plane with x402 payment flow support.

## Getting Started

### Prerequisites

This project requires **Upstash Redis** for persistent storage. This enables serverless deployment on Vercel.

1. Create a free account at [Upstash](https://console.upstash.com/)
2. Create a new Redis database
3. Copy your REST URL and token

### Environment Variables

Set the following environment variables:

```bash
UPSTASH_REDIS_REST_URL=https://your-redis-instance.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-redis-token
```

For local development, create a `.env.local` file with these values.

### Running Locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

## Deploy on Vercel

1. Push your code to GitHub
2. Import the repository on [Vercel](https://vercel.com/new)
3. Add the Upstash Redis environment variables in Project Settings → Environment Variables
4. Deploy!

Alternatively, you can use the [Upstash Integration](https://vercel.com/integrations/upstash) on Vercel to automatically provision and connect a Redis database.

## Architecture

SpendGuard uses Redis to store:
- **Budget state**: Daily spending limits and remaining balance
- **Policy configuration**: Allowed providers, actions, and tasks
- **Audit logs**: Transaction history with decisions
- **Payment nonces**: Replay attack prevention for x402 payments
- **Pending payments**: Payment requirements awaiting verification

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Upstash Redis Documentation](https://docs.upstash.com/redis)
- [Vercel Deployment](https://nextjs.org/docs/app/building-your-application/deploying)
