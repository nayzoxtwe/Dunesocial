# Parental Controls

- **Roles** – Users can be `ADULT`, `TEEN`, or `PARENT`. Seed data links `moi@dune.local` as parent of `eden@dune.local`.
- **Night Mode** – Teen profiles store `nightStart`/`nightEnd` minutes from midnight. UI checks via `applyTeenNightMode` to disable chat input + story upload within blackout window (default 23:00–05:00).
- **API** – `parent.setNightWindow` (tRPC) allows parent accounts to adjust the child's night window. Stored in `ParentalLink` and mirrored to `Profile`.
- **UI Banner** – Teens see a persistent banner when blackout is active, including reminder that parent override is required.
- **Teen Coin Cap** – Transfers enforce `ParentalLink.teenCoinCap` (default 1000 coins/month) and reject attempts exceeding allowance.
- **Next Steps** – Add parent dashboard surface (approve overrides, temporary unlock), content filters, and notification summaries.
