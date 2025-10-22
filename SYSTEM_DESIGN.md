# System Design

## Monorepo
- pnpm + Turborepo workspace with `apps/web`, `apps/api`, `packages/ui`, `packages/proto`.
- Shared TypeScript config and lint/test workflows.

## API (`apps/api`)
- Express HTTP server exposing a `/trpc` endpoint backed by tRPC router modules (`auth`, `user`, `friends`, `chat`, `story`, `wallet`, `parent`, `presence`).
- Socket.IO gateway on the same port for realtime delivery (message fanout, presence, typing, wallet updates, story notifications).
- Prisma ORM targeting PostgreSQL using the schema in `apps/api/prisma/schema.prisma`.
- Cron job (node-cron) purges expired stories every 10 minutes and notifies clients.
- Media uploads handled via base64 payloads written to `/uploads/stories` (S3 adapter TODO).

## Web (`apps/web`)
- Next.js 14 App Router application with NextAuth email magic-links, Prisma adapter, and session->JWT bridging to the API.
- Client-side tRPC proxy (`createTrpcClient`) plus Socket.IO client for realtime message/presence syncing.
- React Query and Zustand-like local state (hooks) orchestrate chat lists, wallets, stories, and QR flows.
- Stories upload uses the File API → base64 → tRPC mutation pattern.
- QR scanner uses `react-qr-reader` to decode payloads and call `friends.acceptQR`.

## Data Flow
1. User authenticates via magic link; NextAuth session callback mints an API JWT stored in `session.apiToken`.
2. Client bootstraps `user.me`, `chat.list`, `story.feed`, `wallet.get` via tRPC.
3. Socket.IO connection joins user + conversation rooms; server updates presence states.
4. Messages posted through tRPC persist via Prisma and broadcast to conversation rooms.
5. Wallet transfers run in a transaction, enforce teen caps, and emit wallet:update events to both participants.
6. QR issue/accept uses HMAC signatures stored in `QRInvite`; accept path validates signature + expiry before creating DM + friend link.

## Persistence Schema Highlights
- `User` stores role (ADULT/TEEN/PARENT) and NextAuth adapter relations.
- `Profile` tracks display name, status, night mode window, and last activity timestamp.
- `Conversation` has `dmKey` for unique DM pair lookups; `Message` stores plaintext (E2EE placeholder) plus metadata.
- `Wallet` & `Transfer` capture balances + history; `ParentalLink` stores child/parent relationships and teen caps.
- `QRInvite` stores signed payloads for QR onboarding; `Story` tracks media URL + expiry.

## Realtime Contracts
- `message:new` – broadcast when tRPC/socket message created.
- `typing` – ephemeral typing notifications per conversation.
- `presence:update` – user status transitions (online/offline/busy).
- `story:new` / `story:expired` – feed changes.
- `wallet:update` – immediate wallet balance refresh after transfers.

## Future Work
- Replace base64 uploads with multipart S3 adapter + AV scanning.
- Integrate libsignal for actual E2EE payloads + device key verification.
- Add Redis-backed ratelimiting and presence heartbeats.
- Expand tests (unit, e2e, load) and productionize deployment (Fly/Vercel).
