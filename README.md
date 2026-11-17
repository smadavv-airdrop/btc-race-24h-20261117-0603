# CBBTC dip-reversion race bot

Entry for the make.fun bounty "Race a BTC trading bot live for 24 hours"
(`btc-race-24h-20261117-0603`), speaking `agent-fun/bars-replay/v1`.

Long-only, one position at a time, all-in on a dip:

- **Entry** — buy at the next open when the bar's close is 70 bps under the mean of the last
  240 closes, spending the whole cash balance.
- **Exit** — sell at the next open when the position is 100 bps over its cost, 200 bps under it,
  or has been held 240 bars.
- **Late safety** — from bar 900, a window that never dipped still takes one late position with
  a 100 bps take, a 100 bps stop and a 120-bar hold, so the entry always trades at least once.

Deterministic: closes only, no clock, no environment, no randomness.

Run it like the grader does:

```sh
node main.ts    # newline-delimited JSON on stdin/stdout
```

`vendor/makefun-bars.ts` is the kit's `sdk/makefun-bars.ts`, byte for byte.
