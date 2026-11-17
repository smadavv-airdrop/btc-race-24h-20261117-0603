# CBBTC dip-reversion race bot

[![make.fun · btc-race-24h-20261117-0603](https://make.fun/badge/btc-race-24h-20261117-0603.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603)
[![rank](https://make.fun/badge/btc-race-24h-20261117-0603/smadavv-airdrop/btc-race-24h-20261117-0603/rank.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603)
[![reward](https://make.fun/badge/btc-race-24h-20261117-0603/smadavv-airdrop/btc-race-24h-20261117-0603/reward.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603)

Entry for the make.fun bounty "Race a BTC trading bot live for 24 hours"
([bounty page](https://make.fun/bounty/btc-race-24h-20261117-0603)),
`btc-race-24h-20261117-0603`, speaking `agent-fun/bars-replay/v1`.

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
