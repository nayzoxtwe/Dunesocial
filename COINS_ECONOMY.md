# Coins Economy

- Conversion: **1€ = 100 coins**. Client display rounds to nearest 10 coins using `coinPackEuroToCoins` helper.
- Seed balances: Moi (900), Nova (650), Eden (400).
- Transfers: tRPC `wallet.transfer` enforces positive integers, balance sufficiency, and teen monthly cap (1000 coins sent since start of month).
- Wallet updates broadcast via Socket.IO `wallet:update` to sender + recipient for realtime balance refresh.
- History: `wallet.get` returns last 20 transfers involving the user.
- Marketplace: Placeholder; extend `wallet.transfer` for sticker purchases and add `stickers` table.
- Taxes / FX: Not yet implemented; future iteration will use daily FX feed and rounding to 10-coin buckets.
