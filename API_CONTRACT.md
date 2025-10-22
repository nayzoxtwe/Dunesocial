# API Contract (tRPC)

All procedures live under `/trpc` and require a Bearer JWT unless noted.

## auth
- `auth.loginMagic(email)` – generates a NextAuth-compatible verification token, logging the magic link URL.

## user
- `user.me()` – returns user profile, wallet snapshot, and accepted friends.
- `user.updateProfile({ display, bio?, status?, nightStart?, nightEnd? })`

## friends
- `friends.issueQR()` – returns `{ qrPng, payload, signature, expiresAt }` for sharing.
- `friends.acceptQR({ payload, signature })` – verifies HMAC + expiry, creates friend link + DM.

## chat
- `chat.list()` – conversations with participant + last message metadata.
- `chat.history({ conversationId, cursor?, limit })` – paginated message history.
- `chat.send({ conversationId, kind?, text?, mediaUrl? })`
- `chat.createDM({ userId })`

## story
- `story.post({ dataUrl })` – stores base64 image/gif and schedules expiry.
- `story.feed()` – active stories for self + friends.

## wallet
- `wallet.get()` – balance and recent transfers.
- `wallet.transfer({ toId, coins, memo? })` – enforces teen cap and balance checks.

## parent
- `parent.setNightWindow({ childId, start, end })` – parent-only mutation adjusting teen blackout window.

## presence
- `presence.set({ status })` – updates profile status and emits realtime update.
