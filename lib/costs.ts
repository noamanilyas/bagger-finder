/** What it costs to get a machine home on top of its price. Change the estimates here. */
export const COSTS = {
  /** dismantling and transport in Rotterdam */
  rotterdamEur: 3200,
  /** some machines need this much more transport */
  extraTransportEur: { min: 1500, max: 2000 },
  /** 16 lakh */
  clearancePkr: 1_600_000,
  /** 2 lakh */
  pakistanTransportPkr: 200_000,
};

/**
 * Advertised prices are asking prices: sellers usually come down, some more than others.
 * Change the expected discount here; the budget filter, the cards and the cost panel all follow.
 */
export const NEGOTIATION = { minPct: 10, maxPct: 20 };

export type PkrRate = {
  /** rupees for one euro */
  rate: number;
  source: string;
  fetchedAt: string;
};

export type CostPanel = {
  /** the total in euros; shows the rupee costs separately when there is no rate to convert them */
  eur: string;
  /** null when there is no rate */
  pkr: string | null;
  /** the same total after the expected discount; null without a price or for ads that are not a sale */
  negotiated: string | null;
  breakdown: string;
  rateNote: string;
};

const eur = (n: number) => n.toLocaleString("de-DE");
const lakh = (pkr: number) => String(Number((pkr / 100_000).toFixed(1)));
const range = (min: string, max: string) => (min === max ? min : `${min}–${max}`);

const afterDiscount = (priceEur: number, pct: number) => Math.round((priceEur * (100 - pct)) / 10_000) * 100;

/** What a seller may accept, rounded to €100: an estimate should not look exact. */
export function negotiatedRange(priceEur: number): { low: number; high: number } {
  return { low: afterDiscount(priceEur, NEGOTIATION.maxPct), high: afterDiscount(priceEur, NEGOTIATION.minPct) };
}

/** One line for a card or map popup, so both say the same. */
export function negotiatedText(priceEur: number): string {
  const { low, high } = negotiatedRange(priceEur);
  return `maybe €${range(eur(low), eur(high))} after ${NEGOTIATION.minPct}–${NEGOTIATION.maxPct}% off`;
}

/** A machine is within budget when the biggest expected discount could bring it there. Whole numbers, to avoid rounding errors. */
export function withinBudget(priceEur: number, maxEur: number): boolean {
  return priceEur * (100 - NEGOTIATION.maxPct) <= maxEur * 100;
}

/** All the text of the Pakistan cost panel, so the list and the map popup always say the same. */
export function costPanel(priceEur: number | null, rate: PkrRate | null, negotiable = true): CostPanel {
  const { rotterdamEur, extraTransportEur: extra, clearancePkr, pakistanTransportPkr } = COSTS;
  const rupees = clearancePkr + pakistanTransportPkr;
  // The parts are rounded before adding, so the breakdown adds up to the total shown.
  const clearanceEur = rate && Math.round(clearancePkr / rate.rate);
  const transportEur = rate && Math.round(pakistanTransportPkr / rate.rate);
  const convertedEur = (clearanceEur ?? 0) + (transportEur ?? 0);
  const totals = (low: number, high: number) => ({
    eur: `€${range(eur(low + rotterdamEur + extra.min + convertedEur), eur(high + rotterdamEur + extra.max + convertedEur))}${rate ? "" : ` + Rs ${lakh(rupees)} lakh`}`,
    pkr:
      rate &&
      `Rs ${range(
        lakh((low + rotterdamEur + extra.min) * rate.rate + rupees),
        lakh((high + rotterdamEur + extra.max) * rate.rate + rupees),
      )} lakh`,
  });
  const asking = totals(priceEur ?? 0, priceEur ?? 0);
  const discounted = priceEur != null && negotiable ? negotiatedRange(priceEur) : null;
  const after = discounted && totals(discounted.low, discounted.high);

  const parts = [
    priceEur != null && `Machine €${eur(priceEur)}`,
    `Rotterdam €${eur(rotterdamEur)}`,
    `extra transport €${range(eur(extra.min), eur(extra.max))}`,
    `clearance ${clearanceEur ? `€${eur(clearanceEur)} (Rs ${lakh(clearancePkr)} lakh)` : `Rs ${lakh(clearancePkr)} lakh`}`,
    `Pakistan transport ${transportEur ? `€${eur(transportEur)} (Rs ${lakh(pakistanTransportPkr)} lakh)` : `Rs ${lakh(pakistanTransportPkr)} lakh`}`,
  ];

  return {
    eur: `${priceEur == null ? "Machine price + " : ""}${asking.eur}`,
    pkr: asking.pkr && `${priceEur == null ? "Machine price + " : ""}${asking.pkr}`,
    negotiated:
      after && `With ${NEGOTIATION.minPct}–${NEGOTIATION.maxPct}% off: ${[after.pkr, after.eur].filter(Boolean).join(" · ")}`,
    breakdown: parts.filter(Boolean).join(" + "),
    rateNote: rate ? `€1 = Rs ${rate.rate.toFixed(2)} (${rate.source})` : "Exchange rate not available",
  };
}

/** The price slider on a map card: how far below the asking price it reaches, and its step. */
export const OFFER_SLIDER = { maxPct: 30, stepEur: 100 };

/** Slider bounds for a price: from the deepest discount (rounded down to a step) up to the asking price. */
export function offerRange(priceEur: number): { min: number; max: number; step: number } {
  const step = OFFER_SLIDER.stepEur;
  const min = Math.floor((priceEur * (100 - OFFER_SLIDER.maxPct)) / 100 / step) * step;
  return { min: Math.max(0, min), max: priceEur, step };
}

/** What a machine lands at in Pakistan if bought for `offerEur`: the rupee total when there is a rate, and the euro total. */
export function landedAt(offerEur: number, rate: PkrRate | null): { pkr: string | null; eur: string } {
  const p = costPanel(offerEur, rate, false);
  return { pkr: p.pkr, eur: p.eur };
}
