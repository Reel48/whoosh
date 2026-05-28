import { supabase } from "@/lib/supabase";
import { getBalance } from "@/lib/wb/ledger";
import { getPositions, type Position } from "@/lib/wb/invest";
import { getQuote } from "@/lib/wb/quotes";

export type LifetimeStats = {
  totalPurchased: number;        // real $ paid via Stripe, expressed in WB cents
  totalPremiumMatch: number;     // free WB from Premium subs
  totalInterest: number;         // SPAXX-tied yield accrued + posted
  totalTransferIn: number;       // received from other users
  totalTransferOut: number;      // sent (negative on the ledger)
  totalBetStake: number;         // bet_stake debits (negative)
  totalBetPayout: number;        // bet_payout credits
  totalInvestBuy: number;        // invest_buy debits (negative)
  totalInvestSell: number;       // invest_sell credits
  totalInvestDividend: number;   // dividend credits
  totalAdjustment: number;       // manual admin adjustments
  ledgerRowCount: number;
};

export type EnrichedPosition = Position & {
  marketPriceCents: number | null;
  marketValueCents: number | null;
  unrealizedCents: number | null;
};

export type Allocation = {
  cashCents: number;
  investedValueCents: number;   // mkt value of stock positions
  investedCostBasisCents: number;
  openWagersCents: number;      // stakes locked in open wagers
  totalEquityCents: number;     // cash + invested mkt + open wagers
};

export type ReturnsBreakdown = {
  /** WB credited from real-USD Stripe purchases (already scaled at 10:1 in the ledger). */
  realDollarsInCents: number;
  /** Free WB granted via Premium match. */
  premiumMatchCents: number;
  /** Sum of all interest credited. */
  interestEarnedCents: number;
  /** Net P/L on settled wagers (payouts − stakes). Negative if losing overall. */
  wagerPlCents: number;
  /** Realized + unrealized investing P/L, including dividends received. */
  investingPlCents: number;
  /** Total dividends received from stock positions. */
  dividendsCents: number;
  /** Net of all transfers (received − sent). */
  netTransfersCents: number;
  /** Admin adjustments. */
  adjustmentsCents: number;
  /** Total return vs. money in (purchases). */
  totalReturnCents: number;
  /** Total return as a fraction of money in (purchases + premium match). 0 if denom is 0. */
  totalReturnFraction: number;
};

export type BalanceSeriesPoint = {
  day: string;
  balanceCents: number;
};

export type DashboardData = {
  allocation: Allocation;
  lifetime: LifetimeStats;
  returns: ReturnsBreakdown;
  positions: EnrichedPosition[];
  balanceSeries: BalanceSeriesPoint[];
};

async function getLifetimeStats(userId: string): Promise<LifetimeStats> {
  const { data, error } = await supabase()
    .rpc("fn_user_lifetime_stats", { p_user_id: userId });
  if (error) throw new Error(`lifetime stats failed: ${error.message}`);
  const r = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null;
  if (!r) {
    return {
      totalPurchased: 0, totalPremiumMatch: 0, totalInterest: 0,
      totalTransferIn: 0, totalTransferOut: 0,
      totalBetStake: 0, totalBetPayout: 0,
      totalInvestBuy: 0, totalInvestSell: 0,
      totalInvestDividend: 0,
      totalAdjustment: 0, ledgerRowCount: 0,
    };
  }
  return {
    totalPurchased:      Number(r.total_purchased        ?? 0),
    totalPremiumMatch:   Number(r.total_premium_match    ?? 0),
    totalInterest:       Number(r.total_interest         ?? 0),
    totalTransferIn:     Number(r.total_transfer_in      ?? 0),
    totalTransferOut:    Number(r.total_transfer_out     ?? 0),
    totalBetStake:       Number(r.total_bet_stake        ?? 0),
    totalBetPayout:      Number(r.total_bet_payout       ?? 0),
    totalInvestBuy:      Number(r.total_invest_buy       ?? 0),
    totalInvestSell:     Number(r.total_invest_sell      ?? 0),
    totalInvestDividend: Number(r.total_invest_dividend  ?? 0),
    totalAdjustment:     Number(r.total_adjustment       ?? 0),
    ledgerRowCount:      Number(r.ledger_row_count       ?? 0),
  };
}

async function getOpenWagerStake(userId: string): Promise<number> {
  const { data, error } = await supabase()
    .rpc("fn_user_open_wager_stake", { p_user_id: userId });
  if (error) throw new Error(`open wager stake failed: ${error.message}`);
  return Number(data ?? 0);
}

async function getBalanceSeries(userId: string, days: number): Promise<BalanceSeriesPoint[]> {
  const { data, error } = await supabase()
    .rpc("fn_user_balance_series", { p_user_id: userId, p_days: days });
  if (error) throw new Error(`balance series failed: ${error.message}`);
  return ((data as { day: string; balance_cents: number }[] | null) ?? []).map((r) => ({
    day: r.day,
    balanceCents: Number(r.balance_cents),
  }));
}

async function enrichPositions(positions: Position[]): Promise<EnrichedPosition[]> {
  return Promise.all(
    positions.map(async (p): Promise<EnrichedPosition> => {
      const q = await getQuote(p.symbol).catch(() => null);
      if (!q) {
        return {
          ...p,
          marketPriceCents: null,
          marketValueCents: null,
          unrealizedCents: null,
        };
      }
      // 1 WB = $1, so q.priceCents (USD) is the same scale as
      // cost_basis_cents (WB). No conversion needed for mark-to-market.
      const mv = Math.round(p.shares * q.priceCents);
      return {
        ...p,
        marketPriceCents: q.priceCents,
        marketValueCents: mv,
        unrealizedCents: mv - p.costBasisCents,
      };
    }),
  );
}

/**
 * Total investing P/L = current market value + realized cash flow.
 * Derivation:
 *   - sum(invest_sell) - sum(invest_buy) is the net cash flow from trading.
 *     Note: invest_buy is negative in the ledger, so summing it gives the
 *     net cash *out* already, but here both values are passed in as signed
 *     ledger amounts (totalInvestBuy will be ≤ 0, totalInvestSell ≥ 0).
 *   - Add the current market value of still-open positions.
 * So P/L = totalInvestSell + totalInvestBuy + currentMarketValue.
 */
function investingPl(
  totalInvestBuy: number,    // ≤ 0
  totalInvestSell: number,   // ≥ 0
  currentInvestedValue: number,
): number {
  return totalInvestBuy + totalInvestSell + currentInvestedValue;
}

export async function loadDashboard(userId: string): Promise<DashboardData> {
  const [cashCents, lifetime, openWagersCents, positionsRaw, balanceSeries] =
    await Promise.all([
      getBalance(userId),
      getLifetimeStats(userId),
      getOpenWagerStake(userId),
      getPositions(userId),
      getBalanceSeries(userId, 90),
    ]);

  const positions = await enrichPositions(positionsRaw);

  // For positions with no quote (Yahoo failure), fall back to cost basis so
  // we don't claim equity went to zero on a transient outage.
  const investedValueCents = positions.reduce((acc, p) => {
    return acc + (p.marketValueCents ?? p.costBasisCents);
  }, 0);
  const investedCostBasisCents = positions.reduce((acc, p) => acc + p.costBasisCents, 0);

  const totalEquityCents = cashCents + investedValueCents + openWagersCents;

  const wagerPlCents = lifetime.totalBetStake + lifetime.totalBetPayout; // stake is negative
  // Investing P/L includes dividends received over the position's life — they
  // came out of stocks the user owned and are conceptually part of the trade
  // return, not separate income.
  const investingPlCents =
    investingPl(lifetime.totalInvestBuy, lifetime.totalInvestSell, investedValueCents) +
    lifetime.totalInvestDividend;
  const netTransfersCents = lifetime.totalTransferIn + lifetime.totalTransferOut; // out is negative

  const totalReturnCents = totalEquityCents - lifetime.totalPurchased;
  const denom = lifetime.totalPurchased + lifetime.totalPremiumMatch;
  const totalReturnFraction = denom > 0 ? totalReturnCents / denom : 0;

  return {
    allocation: {
      cashCents,
      investedValueCents,
      investedCostBasisCents,
      openWagersCents,
      totalEquityCents,
    },
    lifetime,
    returns: {
      realDollarsInCents:  lifetime.totalPurchased,
      premiumMatchCents:   lifetime.totalPremiumMatch,
      interestEarnedCents: lifetime.totalInterest,
      wagerPlCents,
      investingPlCents,
      dividendsCents:      lifetime.totalInvestDividend,
      netTransfersCents,
      adjustmentsCents:    lifetime.totalAdjustment,
      totalReturnCents,
      totalReturnFraction,
    },
    positions,
    balanceSeries,
  };
}
