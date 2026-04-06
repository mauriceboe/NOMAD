import { db } from '../db/database';

const EXCHANGE_RATE_TTL_MS = (parseInt(process.env.EXCHANGE_RATE_TTL_HOURS || '6', 10)) * 3600 * 1000;
const API_BASE = 'https://api.exchangerate-api.com/v4/latest';
const FETCH_TIMEOUT_MS = 10000;

interface CachedRate {
  rate: number;
  fetched_at: string;
}

/**
 * Fetch all exchange rates for a base currency from the external API
 * and upsert them into the exchange_rates table.
 */
export async function fetchAndCacheRates(baseCurrency: string): Promise<Record<string, number>> {
  const url = `${API_BASE}/${baseCurrency.toUpperCase()}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) {
    throw new Error(`Exchange rate API error: ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as { rates?: Record<string, number> };
  const rates: Record<string, number> = data.rates || {};

  const upsert = db.prepare(`
    INSERT INTO exchange_rates (base_currency, target_currency, rate, fetched_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(base_currency, target_currency) DO UPDATE SET
      rate = excluded.rate,
      fetched_at = excluded.fetched_at
  `);

  const insertMany = db.transaction(() => {
    for (const [target, rate] of Object.entries(rates)) {
      upsert.run(baseCurrency.toUpperCase(), target.toUpperCase(), rate);
    }
  });
  insertMany();

  console.log(`[ExchangeRates] Cached ${Object.keys(rates).length} rates for ${baseCurrency}`);
  return rates;
}

/**
 * Get a cached exchange rate. Returns null if no cached rate exists
 * or if the cached rate is stale (older than TTL).
 */
export function getRate(from: string, to: string): number | null {
  from = from.toUpperCase();
  to = to.toUpperCase();
  if (from === to) return 1;

  const row = db.prepare(
    'SELECT rate, fetched_at FROM exchange_rates WHERE base_currency = ? AND target_currency = ?'
  ).get(from, to) as CachedRate | undefined;

  if (!row) return null;

  const age = Date.now() - new Date(row.fetched_at + 'Z').getTime();
  if (age > EXCHANGE_RATE_TTL_MS) return null; // stale

  return row.rate;
}

/**
 * Check whether we have fresh (non-stale) cached rates for a base currency.
 */
export function hasFreshRates(baseCurrency: string): boolean {
  const row = db.prepare(
    'SELECT fetched_at FROM exchange_rates WHERE base_currency = ? LIMIT 1'
  ).get(baseCurrency.toUpperCase()) as CachedRate | undefined;
  if (!row) return false;
  const age = Date.now() - new Date(row.fetched_at + 'Z').getTime();
  return age <= EXCHANGE_RATE_TTL_MS;
}

/**
 * Get a cached exchange rate, ignoring staleness (fallback for when API is down).
 */
export function getRateAnyAge(from: string, to: string): number | null {
  from = from.toUpperCase();
  to = to.toUpperCase();
  if (from === to) return 1;

  const row = db.prepare(
    'SELECT rate FROM exchange_rates WHERE base_currency = ? AND target_currency = ?'
  ).get(from, to) as { rate: number } | undefined;

  return row?.rate ?? null;
}

/**
 * Convert an amount from one currency to another.
 * Fetches and caches rates if needed. Falls back to stale cache if API fails.
 * Returns null only if no rate is available at all.
 */
export async function convertAmount(amount: number, from: string, to: string): Promise<number | null> {
  from = from.toUpperCase();
  to = to.toUpperCase();
  if (from === to) return amount;

  // Try fresh cache first
  let rate = getRate(from, to);
  if (rate !== null) return amount * rate;

  // Cache miss or stale — try fetching
  try {
    await fetchAndCacheRates(from);
    rate = getRate(from, to);
    if (rate !== null) return amount * rate;
  } catch (err) {
    console.error('[ExchangeRates] Fetch failed, falling back to stale cache:', err instanceof Error ? err.message : err);
  }

  // Fallback to stale cache
  rate = getRateAnyAge(from, to);
  if (rate !== null) return amount * rate;

  return null; // No rate available at all
}

/**
 * Recalculate all converted_price values for a trip using current rates.
 * Called when the trip's base currency changes or when rates are manually refreshed.
 */
export async function recalculateTrip(tripId: number | string): Promise<void> {
  const trip = db.prepare('SELECT currency FROM trips WHERE id = ?').get(tripId) as { currency: string } | undefined;
  if (!trip) return;

  const baseCurrency = trip.currency.toUpperCase();

  const items = db.prepare(
    'SELECT id, total_price, item_currency FROM budget_items WHERE trip_id = ?'
  ).all(tripId) as { id: number; total_price: number; item_currency: string | null }[];

  const update = db.prepare('UPDATE budget_items SET converted_price = ? WHERE id = ?');

  const uniqueCurrencies = [...new Set(
    items.map(i => (i.item_currency || baseCurrency).toUpperCase()).filter(c => c !== baseCurrency)
  )];
  for (const cur of uniqueCurrencies) {
    if (!hasFreshRates(cur)) {
      try { await fetchAndCacheRates(cur); } catch (err) {
        console.error(`[ExchangeRates] Failed to fetch rates for ${cur}, will use stale cache:`, err instanceof Error ? err.message : err);
      }
    }
  }

  const conversions = items.map((item) => {
    const itemCur = (item.item_currency || baseCurrency).toUpperCase();
    if (itemCur === baseCurrency) return { id: item.id, converted: item.total_price };
    const rate = getRate(itemCur, baseCurrency) ?? getRateAnyAge(itemCur, baseCurrency);
    return { id: item.id, converted: rate !== null ? item.total_price * rate : null };
  });

  const failed = conversions.filter(c => c.converted === null).length;
  if (failed > 0) {
    console.warn(`[ExchangeRates] recalculateTrip(${tripId}): ${failed}/${conversions.length} items could not be converted (no rate available)`);
  }

  const updateAll = db.transaction(() => {
    for (const { id, converted } of conversions) {
      update.run(converted, id);
    }
  });
  updateAll();
}

/**
 * Get the last fetched_at timestamp for any rate with the given base currency.
 * Used for the "rates last updated" indicator.
 */
export function getRatesFetchedAt(baseCurrency: string): string | null {
  const row = db.prepare(
    'SELECT MAX(fetched_at) as last_fetched FROM exchange_rates WHERE base_currency = ?'
  ).get(baseCurrency.toUpperCase()) as { last_fetched: string | null } | undefined;
  return row?.last_fetched ?? null;
}
