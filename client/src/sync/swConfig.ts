/**
 * SW cache configuration — shared between the service worker and the main thread.
 * Uses a dedicated 'trek-sw-config' IndexedDB database (separate from trek-offline)
 * so the SW can read it without needing to know the full trek-offline schema versions.
 */
import Dexie, { type Table } from 'dexie';

export interface SwCacheConfig {
  apiTtlDays: number;
  apiMaxEntries: number;
  tilesTtlDays: number;
  tilesMaxEntries: number;
}

export const DEFAULT_SW_CONFIG: SwCacheConfig = {
  apiTtlDays: 7,
  apiMaxEntries: 500,
  tilesTtlDays: 30,
  tilesMaxEntries: 1000,
};

export const SW_CONFIG_BOUNDS = {
  ttlMin: 1,
  ttlMax: 365,
  entriesMin: 10,
  entriesMax: 5000,
};

export function validateSwConfig(raw: Partial<SwCacheConfig>): SwCacheConfig {
  const clamp = (v: unknown, min: number, max: number, def: number): number => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? Math.max(min, Math.min(max, Math.round(n))) : def;
  };
  return {
    apiTtlDays:     clamp(raw.apiTtlDays,     SW_CONFIG_BOUNDS.ttlMin, SW_CONFIG_BOUNDS.ttlMax, DEFAULT_SW_CONFIG.apiTtlDays),
    apiMaxEntries:  clamp(raw.apiMaxEntries,   SW_CONFIG_BOUNDS.entriesMin, SW_CONFIG_BOUNDS.entriesMax, DEFAULT_SW_CONFIG.apiMaxEntries),
    tilesTtlDays:   clamp(raw.tilesTtlDays,   SW_CONFIG_BOUNDS.ttlMin, SW_CONFIG_BOUNDS.ttlMax, DEFAULT_SW_CONFIG.tilesTtlDays),
    tilesMaxEntries:clamp(raw.tilesMaxEntries, SW_CONFIG_BOUNDS.entriesMin, SW_CONFIG_BOUNDS.entriesMax, DEFAULT_SW_CONFIG.tilesMaxEntries),
  };
}

// ── Dedicated IDB for SW config ───────────────────────────────────────────────

interface SwConfigRow extends SwCacheConfig {
  id: 'singleton';
  updatedAt: number;
}

class SwConfigDb extends Dexie {
  config!: Table<SwConfigRow, 'singleton'>;
  constructor() {
    super('trek-sw-config');
    this.version(1).stores({ config: 'id' });
  }
}

let _db: SwConfigDb | null = null;

function getDb(): SwConfigDb {
  if (!_db) _db = new SwConfigDb();
  return _db;
}

export async function readSwConfigFromIDB(): Promise<SwCacheConfig | null> {
  try {
    const row = await getDb().config.get('singleton');
    return row ? validateSwConfig(row) : null;
  } catch {
    return null;
  }
}

export async function saveSwConfig(cfg: SwCacheConfig): Promise<void> {
  const validated = validateSwConfig(cfg);
  await getDb().config.put({ id: 'singleton', ...validated, updatedAt: Date.now() });
}

export async function loadSwConfig(): Promise<SwCacheConfig> {
  return (await readSwConfigFromIDB()) ?? { ...DEFAULT_SW_CONFIG };
}
