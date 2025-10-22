# Security Notes

- **Authentication** – NextAuth email magic-links with Prisma adapter; sessions issue short-lived JWTs (1h) for API access.
- **Authorization** – tRPC procedures enforce `authenticatedProcedure`; parent actions gated by role checks.
- **Transport** – Socket.IO + HTTP share the same JWT for identity. (Enable HTTPS/secure cookies in production.)
- **QR Signatures** – Friend QR payloads are signed with HMAC-SHA256 (`QR_SECRET`/`JWT_SECRET`); accept flow validates signature + expiry.
- **Presence** – Socket handshakes validate JWT and upsert profile status to mitigate spoofing.
- **Coins Transfers** – Transactions enforce balance checks and teen monthly caps; wallet updates emitted only after Prisma commit.
- **Night Mode** – Teen accounts have enforced blackout windows stored in DB, surfaced to UI for read-only restrictions.
- **Media Storage** – Stories saved to local filesystem; TODO: integrate AV scanning + presigned uploads for production.
- **Secrets** – `.env` houses `JWT_SECRET`, `NEXTAUTH_SECRET`, etc. Rotate for production deployments.
- **Ratelimiting / Abuse** – Not yet implemented; roadmap includes IP/user scoped Redis counters and abuse heuristics.
