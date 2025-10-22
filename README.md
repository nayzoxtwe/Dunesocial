# Dune Messenger

Prototype social messenger inspired by LINE with dark theme chat, QR friend onboarding, realtime messaging, and parental controls. The monorepo uses pnpm with a Next.js 14 frontend and an Express+tRPC API backed by PostgreSQL/Prisma.

## Stack Overview

- **apps/web** – Next.js 14 (App Router) client with NextAuth magic-link auth, tRPC client, Socket.IO presence, stories uploader, wallet UI, and QR scanner.
- **apps/api** – Express server exposing tRPC routers, Socket.IO realtime gateway, Prisma ORM, media upload handling, and cron cleanup for stories.
- **packages/ui** – Shared chat surfaces (message bubbles, story bar, bottom navigation) with Tailwind-compliant styling.
- **packages/proto** – Shared helpers (teen night-mode utility, Signal-style safety number) plus exported `AppRouter` types for tRPC clients.

## Prerequisites

- Node.js 18+
- pnpm 8+
- PostgreSQL 14+ running locally (configure `DATABASE_URL`)

## Setup

```bash
pnpm install
cp .env.example .env
pnpm db:push
pnpm db:seed
```

Start the services in separate terminals:

```bash
pnpm dev:api   # Express+tRPC API on http://localhost:4000
pnpm dev:web   # Next.js app on http://localhost:3000
```

Seed accounts (`moi@dune.local`, `nova@dune.local`, `eden@dune.local`) have preloaded wallets, DM history, and parental links.

## Auth Flow

1. Visit `http://localhost:3000` and request a magic link with one of the seed emails.
2. Copy the link printed in the Next.js server logs and open it in the browser to finish login.
3. The UI will connect to the API via tRPC and Socket.IO using the issued session token.

## Feature Highlights

- 1:1 chats with realtime updates, typing indicators, and presence badges.
- QR friend invites signed server-side; Scan tab uses camera stream to accept payloads and auto-create secure DMs.
- Stories uploader (24h expiry with cron purge) backed by local `/uploads/stories` storage.
- Wallet transfers with teen monthly caps and live balance refresh.
- Teen night mode banner/enforcement (23:00–05:00 default) with parental override API.

## Testing & Tooling

- `pnpm test` – runs Node test stubs (expand with Vitest/Jest later).
- `pnpm lint` – placeholder lint script.
- GitHub Actions CI (`.github/workflows/ci.yml`) installs, lints, tests.

## Useful Scripts

- `pnpm dev:api` – start API with ts-node-dev and Socket.IO hot reload.
- `pnpm dev:web` – Next.js dev server with hot reload and NextAuth routes.
- `pnpm db:push` – apply Prisma schema to database.
- `pnpm db:seed` – seed demo data.

## Media Storage

Stories and uploaded assets store under `./uploads/stories`. Ensure the directory is writable. For production, replace with S3-compatible storage and update the API adapter.

## Environment Variables

See `.env.example` for required configuration (database, JWT secrets, API origin, etc.).
