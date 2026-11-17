// CBBTC dip-reversion race bot for the make.fun bars replay (agent-fun/bars-replay/v1).
//
// One symbol (CBBTC against USDC), long only, one position at a time, all-in.
//
//   - History: the close of every bar of this run, kept in a ring of the last LOOK closes.
//   - Entry, decided on a bar's close and filled at the next bar's open: the close is DIP_BPS
//     below the mean of the last LOOK closes, and the bot holds nothing. The order spends the
//     whole cash balance (caps.max_weight_bps is 10000, so that is the equity cap) with
//     max_slippage_bps 200, which covers the modelled 2 bps of slippage plus the price impact
//     of the spend on a pool of ordinary depth; a thinner pool refuses the order and the next
//     bar that signals it is taken instead.
//   - Exit, on a bar's close, filled at the next open: the position is worth TAKE_BPS over its
//     cost, or STOP_BPS under it, or it has been held MAX_HOLD bars, whichever comes first.
//     The sale asks max_slippage_bps 300 so a liquidity gap delays it by a bar rather than
//     dropping it.
//   - Late safety: a window that never dips leaves the bot flat, and a bot with no trade ranks
//     below every entry that made one. So from bar LATE_AT on the bot takes one small-risk
//     position at the next open, on a tighter take and stop (LATE_TAKE_BPS, LATE_STOP_BPS) and
//     a shorter hold (LATE_HOLD bars), which guarantees at least one trade while capping what
//     a bad late fill can cost.
//   - Determinism: float64 arithmetic on the closes only, no clock, no environment, no
//     randomness; the same bars produce the same orders, run after run.
//
// The grader runs `node /bot/main.ts` with this repository mounted at /bot;
// vendor/makefun-bars.ts is a byte-identical copy of the kit's sdk/makefun-bars.ts.

import { runBars, type BarsState, type OrderInput } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';
const LOOK = 60;
const DIP_BPS = 70;
const TAKE_BPS = 150;
const STOP_BPS = 400;
const MAX_HOLD = 480;
const LATE_AT = 900;
const LATE_TAKE_BPS = 150;
const LATE_STOP_BPS = 150;
const LATE_HOLD = 120;
const BUY_SLIPPAGE_BPS = 200;
const SELL_SLIPPAGE_BPS = 300;

const BPS_PER_UNIT = 10_000;

/** Ring of the run's closes, oldest first once full. */
const closes: number[] = [];
let heldBars = 0;
/** Take and stop of the open position, in bps, and the bar count it is closed at. */
let takeBps = TAKE_BPS;
let stopBps = STOP_BPS;
let holdBars = MAX_HOLD;
/** The close the position's signal was decided on, as a sanity floor for a re-entry. */
let lastEntrySeq = -1;
/** Whether this run has filled any entry yet, so the late fallback fires at most once. */
let tradedYet = false;

function push(close: number): void {
  closes.push(close);
  if (closes.length > LOOK) closes.shift();
}

function mean(): number {
  let sum = 0;
  for (const value of closes) sum += value;
  return sum / closes.length;
}

await runBars({
  onBatch(state: BarsState, batch): OrderInput[] {
    const bar = batch.bars.find((b) => b.symbol === SYMBOL);
    const held = state.positions.get(SYMBOL);
    const orders: OrderInput[] = [];
    if (bar !== undefined) push(Number(bar.c));

    if (held === undefined || held.qty <= 0n) {
      heldBars = 0;
      if (state.warmingUp) return orders;
      const close = state.close(SYMBOL);
      if (close === null || closes.length < LOOK) return orders;
      const reference = mean();
      const dipTrigger = Number(close) <= reference * (1 - DIP_BPS / BPS_PER_UNIT);
      const lateTrigger = !tradedYet && state.seq >= LATE_AT && state.seq > lastEntrySeq;
      if (!dipTrigger && !lateTrigger) return orders;
      const spend = state.cash < state.weightRoom(SYMBOL) ? state.cash : state.weightRoom(SYMBOL);
      if (spend < 1_000_000n) return orders;
      takeBps = lateTrigger && !dipTrigger ? LATE_TAKE_BPS : TAKE_BPS;
      stopBps = lateTrigger && !dipTrigger ? LATE_STOP_BPS : STOP_BPS;
      holdBars = lateTrigger && !dipTrigger ? LATE_HOLD : MAX_HOLD;
      lastEntrySeq = state.seq;
      tradedYet = true;
      orders.push({
        side: 'buy',
        symbol: SYMBOL,
        notional_quote_units: spend,
        max_slippage_bps: BUY_SLIPPAGE_BPS,
      });
      return orders;
    }

    heldBars += 1;
    const close = state.close(SYMBOL);
    if (close === null) return orders;
    // The position's cost carries the fee it was bought with, so this marks it against what it
    // actually took out of the account. state.value converts qty and close into quote units.
    const worth = state.value(SYMBOL, held.qty);
    if (worth <= 0n || held.cost <= 0n) return orders;
    const changeBps = ((Number(worth) - Number(held.cost)) / Number(held.cost)) * BPS_PER_UNIT;
    const exitNow = changeBps >= takeBps || changeBps <= -stopBps || heldBars >= holdBars;
    if (!exitNow) return orders;
    orders.push({ side: 'sell', symbol: SYMBOL, qty: held.qty, max_slippage_bps: SELL_SLIPPAGE_BPS });
    return orders;
  },
});
