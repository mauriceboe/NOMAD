/**
 * Weather API fetch layer with file-based caching, throttling, retry,
 * and request consolidation for open-meteo.com APIs.
 *
 * Solves ETIMEDOUT errors caused by burst concurrency against the
 * open-meteo server which silently drops TLS connections under load.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import https from 'https';
import fetch from 'node-fetch';

// Force IPv4 to avoid ETIMEDOUT on Docker bridge networks where IPv6 cannot route
const ipv4Agent = new https.Agent({ family: 4 });

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const CACHE_DIR = process.env.WEATHER_CACHE_DIR || '/app/data/weather-cache';
const INTER_REQUEST_DELAY_MS = 300;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1000;
const RETRY_MULTIPLIER = 3; // 1s, 3s, 9s
const RETRYABLE_CODES = new Set(['ETIMEDOUT', 'ECONNRESET', 'ENOTFOUND']);

const FORECAST_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

// Consolidation: buffer archive requests this long to collect overlapping ranges
const CONSOLIDATION_BUFFER_MS = 50;

// ---------------------------------------------------------------------------
// File-based cache
// ---------------------------------------------------------------------------

interface CacheEntry {
  url: string;
  data: unknown;
  createdAt: number;
  expiresAt: number | null; // null = never expires (historical data)
}

/** In-memory index: cacheKey -> { filePath, expiresAt } */
const cacheIndex = new Map<string, { filePath: string; expiresAt: number | null }>();

function cacheKeyForUrl(url: string): string {
  return crypto.createHash('sha256').update(url).digest('hex').slice(0, 32);
}

function cacheFilePath(key: string): string {
  return path.join(CACHE_DIR, `${key}.json`);
}

function isHistoricalRequest(url: string): boolean {
  return url.includes('archive-api.open-meteo.com');
}

function initCacheDir(): void {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  } catch {
    console.warn(`[weather-cache] Could not create cache dir ${CACHE_DIR}`);
  }
}

export function loadCacheIndex(): void {
  initCacheDir();

  let files: string[];
  try {
    files = fs.readdirSync(CACHE_DIR).filter(f => f.endsWith('.json'));
  } catch {
    console.warn('[weather-cache] Could not read cache directory');
    return;
  }

  let historical = 0;
  let forecast = 0;
  let expired = 0;
  const now = Date.now();

  for (const file of files) {
    try {
      const filePath = path.join(CACHE_DIR, file);
      const raw = fs.readFileSync(filePath, 'utf-8');
      const entry: CacheEntry = JSON.parse(raw);
      const key = file.replace('.json', '');

      // Prune expired entries
      if (entry.expiresAt !== null && now > entry.expiresAt) {
        fs.unlinkSync(filePath);
        expired++;
        continue;
      }

      cacheIndex.set(key, { filePath, expiresAt: entry.expiresAt });
      if (entry.expiresAt === null) historical++;
      else forecast++;
    } catch {
      // Skip corrupt files
    }
  }

  console.log(
    `[weather-cache] Weather cache: ${historical + forecast} entries loaded, ` +
    `${historical} historical (permanent), ${forecast} forecast (expiring)` +
    (expired > 0 ? `, ${expired} expired entries pruned` : '')
  );
}

function readFromCache(url: string): unknown | null {
  const key = cacheKeyForUrl(url);
  const meta = cacheIndex.get(key);
  if (!meta) return null;

  // Check TTL
  if (meta.expiresAt !== null && Date.now() > meta.expiresAt) {
    cacheIndex.delete(key);
    try { fs.unlinkSync(meta.filePath); } catch { /* ignore */ }
    return null;
  }

  try {
    const raw = fs.readFileSync(meta.filePath, 'utf-8');
    const entry: CacheEntry = JSON.parse(raw);
    console.log(`[weather-cache] HIT: ${urlLabel(url)}`);
    return entry.data;
  } catch {
    cacheIndex.delete(key);
    return null;
  }
}

function writeToCache(url: string, data: unknown): void {
  const key = cacheKeyForUrl(url);
  const filePath = cacheFilePath(key);
  const historical = isHistoricalRequest(url);
  const expiresAt = historical ? null : Date.now() + FORECAST_CACHE_TTL_MS;

  const entry: CacheEntry = { url, data, createdAt: Date.now(), expiresAt };

  try {
    fs.writeFileSync(filePath, JSON.stringify(entry), 'utf-8');
    cacheIndex.set(key, { filePath, expiresAt });
  } catch (err) {
    console.warn(`[weather-cache] Write error for ${urlLabel(url)}:`, err);
  }
}

function urlLabel(url: string): string {
  try {
    const u = new URL(url);
    const lat = u.searchParams.get('latitude') || '?';
    const lng = u.searchParams.get('longitude') || '?';
    const start = u.searchParams.get('start_date') || '';
    const end = u.searchParams.get('end_date') || '';
    const dateRange = start ? `${start}..${end || start}` : 'current';
    return `${u.hostname} [${lat},${lng}] ${dateRange}`;
  } catch {
    return url.slice(0, 80);
  }
}

// ---------------------------------------------------------------------------
// Sequential request queue (singleton)
//
// ALL open-meteo HTTP requests flow through this single queue.
// Processes strictly one request at a time, with a 300ms delay between.
// ---------------------------------------------------------------------------

interface QueueItem {
  fn: () => Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (err: unknown) => void;
}

const queue: QueueItem[] = [];
let processing = false;

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    queue.push({ fn, resolve: resolve as (v: unknown) => void, reject });
    processQueue();
  });
}

async function processQueue(): Promise<void> {
  if (processing) return;
  processing = true;

  while (queue.length > 0) {
    const item = queue.shift()!;
    try {
      const result = await item.fn();
      item.resolve(result);
    } catch (err) {
      item.reject(err);
    }
    // Wait 300ms before next request, but only if there are more queued
    if (queue.length > 0) {
      await delay(INTER_REQUEST_DELAY_MS);
    }
  }

  processing = false;
}

// ---------------------------------------------------------------------------
// Retry with exponential backoff
// ---------------------------------------------------------------------------

function isRetryableError(err: unknown): boolean {
  if (err && typeof err === 'object') {
    const code = (err as { code?: string }).code;
    if (code && RETRYABLE_CODES.has(code)) return true;
    const type = (err as { type?: string }).type;
    if (type === 'system') return true;
  }
  return false;
}

async function fetchWithRetry(url: string, requestLabel: string) {
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        const backoff = RETRY_BASE_DELAY_MS * Math.pow(RETRY_MULTIPLIER, attempt - 1);
        console.log(
          `[weather-fetch] Retry ${attempt}/${MAX_RETRIES} for ${requestLabel} ` +
          `(waiting ${backoff}ms, ${MAX_RETRIES - attempt} attempts remaining)`
        );
        await delay(backoff);
      }

      const response = await fetch(url, { agent: ipv4Agent });
      return response;
    } catch (err) {
      lastError = err;
      if (!isRetryableError(err) || attempt === MAX_RETRIES) {
        throw err;
      }
      console.warn(
        `[weather-fetch] Network error on attempt ${attempt + 1}/${MAX_RETRIES + 1}: ` +
        `${(err as { code?: string }).code || err}`
      );
    }
  }

  throw lastError;
}

// ---------------------------------------------------------------------------
// Archive request consolidation
//
// When multiple archive-api requests arrive within CONSOLIDATION_BUFFER_MS
// for the same (rounded) coordinates and same param set, they are merged
// into a single request covering the full date span. The response is then
// sliced back into per-caller date ranges.
// ---------------------------------------------------------------------------

interface PendingArchiveRequest {
  originalUrl: string;
  lat: string;
  lng: string;
  startDate: string;
  endDate: string;
  /** All query params except latitude, longitude, start_date, end_date, timezone */
  fieldParams: string;
  resolve: (result: { data: unknown; response: { ok: boolean; status: number } }) => void;
  reject: (err: unknown) => void;
}

const pendingArchive: PendingArchiveRequest[] = [];
let consolidationTimer: ReturnType<typeof setTimeout> | null = null;

function roundCoord(val: string): string {
  return parseFloat(val).toFixed(2);
}

function parseArchiveUrl(url: string): { lat: string; lng: string; startDate: string; endDate: string; fieldParams: string } | null {
  try {
    const u = new URL(url);
    const lat = u.searchParams.get('latitude');
    const lng = u.searchParams.get('longitude');
    const startDate = u.searchParams.get('start_date');
    const endDate = u.searchParams.get('end_date');
    if (!lat || !lng || !startDate || !endDate) return null;

    // Collect all params that aren't coordinates/dates/timezone — these define the "field set"
    const skipKeys = new Set(['latitude', 'longitude', 'start_date', 'end_date', 'timezone']);
    const fieldParts: string[] = [];
    u.searchParams.forEach((value, key) => {
      if (!skipKeys.has(key)) fieldParts.push(`${key}=${value}`);
    });
    fieldParts.sort(); // canonical order for grouping
    return { lat, lng, startDate, endDate, fieldParams: fieldParts.join('&') };
  } catch {
    return null;
  }
}

/**
 * Slice an OpenMeteo response to only include data within [startDate, endDate].
 * Filters daily.time[] and hourly.time[] arrays and their corresponding value arrays.
 */
function sliceResponseForDateRange(fullData: Record<string, unknown>, startDate: string, endDate: string): Record<string, unknown> {
  const result: Record<string, unknown> = { ...fullData };

  // Slice daily arrays
  if (fullData.daily && typeof fullData.daily === 'object') {
    const daily = fullData.daily as Record<string, unknown[]>;
    if (Array.isArray(daily.time)) {
      const indices: number[] = [];
      for (let i = 0; i < daily.time.length; i++) {
        const d = daily.time[i] as string;
        if (d >= startDate && d <= endDate) indices.push(i);
      }
      const slicedDaily: Record<string, unknown[]> = {};
      for (const [key, arr] of Object.entries(daily)) {
        if (Array.isArray(arr)) {
          slicedDaily[key] = indices.map(i => arr[i]);
        }
      }
      result.daily = slicedDaily;
    }
  }

  // Slice hourly arrays
  if (fullData.hourly && typeof fullData.hourly === 'object') {
    const hourly = fullData.hourly as Record<string, unknown[]>;
    if (Array.isArray(hourly.time)) {
      const indices: number[] = [];
      for (let i = 0; i < hourly.time.length; i++) {
        const t = (hourly.time[i] as string).slice(0, 10); // extract YYYY-MM-DD
        if (t >= startDate && t <= endDate) indices.push(i);
      }
      const slicedHourly: Record<string, unknown[]> = {};
      for (const [key, arr] of Object.entries(hourly)) {
        if (Array.isArray(arr)) {
          slicedHourly[key] = indices.map(i => arr[i]);
        }
      }
      result.hourly = slicedHourly;
    }
  }

  return result;
}

function flushConsolidationBuffer(): void {
  consolidationTimer = null;
  const batch = pendingArchive.splice(0);
  if (batch.length === 0) return;

  // Group by rounded coordinates + field params
  const groups = new Map<string, PendingArchiveRequest[]>();
  for (const req of batch) {
    const key = `${roundCoord(req.lat)}_${roundCoord(req.lng)}_${req.fieldParams}`;
    let group = groups.get(key);
    if (!group) {
      group = [];
      groups.set(key, group);
    }
    group.push(req);
  }

  let totalOriginal = 0;
  let totalConsolidated = 0;

  for (const [, group] of groups) {
    totalOriginal += group.length;

    // Find min start and max end across all requests in this group
    let minStart = group[0].startDate;
    let maxEnd = group[0].endDate;
    for (const req of group) {
      if (req.startDate < minStart) minStart = req.startDate;
      if (req.endDate > maxEnd) maxEnd = req.endDate;
    }

    totalConsolidated++;

    // Build the merged URL using the first request's coordinates (they're all ~same after rounding)
    const representative = group[0];
    const mergedUrl = `https://archive-api.open-meteo.com/v1/archive`
      + `?latitude=${representative.lat}&longitude=${representative.lng}`
      + `&start_date=${minStart}&end_date=${maxEnd}`
      + (representative.fieldParams ? `&${representative.fieldParams}` : '')
      + `&timezone=auto`;

    // Enqueue the single merged fetch — this goes through the sequential queue
    executeMergedFetch(mergedUrl, group, minStart, maxEnd);
  }

  console.log(
    `[weather-queue] Queued ${totalOriginal} requests, consolidated to ${totalConsolidated} after merging`
  );
}

async function executeMergedFetch(
  mergedUrl: string,
  callers: PendingArchiveRequest[],
  mergedStart: string,
  mergedEnd: string,
): Promise<void> {
  try {
    // Check cache for the merged URL first
    const cached = readFromCache(mergedUrl);
    if (cached !== null) {
      const fullData = cached as Record<string, unknown>;
      for (const caller of callers) {
        const sliced = sliceResponseForDateRange(fullData, caller.startDate, caller.endDate);
        writeToCache(caller.originalUrl, sliced);
        caller.resolve({ data: sliced, response: { ok: true, status: 200 } });
      }
      return;
    }

    // Enqueue the actual HTTP request through the sequential queue
    const result = await enqueue(async () => {
      const label = urlLabel(mergedUrl);
      console.log(
        `[weather-queue] Processing request ${getQueuePosition()}` +
        ` (merged ${callers.length} callers, range ${mergedStart}..${mergedEnd})`
      );

      const response = await fetchWithRetry(mergedUrl, label);
      const data = await response.json();

      if (response.ok) {
        writeToCache(mergedUrl, data);
      }

      return { data, ok: response.ok, status: response.status };
    }) as { data: unknown; ok: boolean; status: number };

    const fullData = result.data as Record<string, unknown>;

    // Deliver sliced results to each original caller
    for (const caller of callers) {
      const sliced = sliceResponseForDateRange(fullData, caller.startDate, caller.endDate);
      // Also cache individual URLs for future direct hits
      if (result.ok) {
        writeToCache(caller.originalUrl, sliced);
      }
      caller.resolve({ data: sliced, response: { ok: result.ok, status: result.status } });
    }
  } catch (err) {
    for (const caller of callers) {
      caller.reject(err);
    }
  }
}

/** Simple monotonic counter for log output */
let totalProcessed = 0;

function getQueuePosition(): string {
  totalProcessed++;
  return `#${totalProcessed}`;
}

// ---------------------------------------------------------------------------
// Public API: throttled fetch with caching and consolidation
// ---------------------------------------------------------------------------

/**
 * Fetch a URL from open-meteo with caching, sequential queueing, and retry.
 * Archive API requests are automatically consolidated when multiple arrive
 * within a short window for the same coordinates.
 */
export async function weatherFetch<T = unknown>(url: string): Promise<{ data: T; response: { ok: boolean; status: number } }> {
  // 1. Check file cache first (fast path, no queueing)
  const cached = readFromCache(url);
  if (cached !== null) {
    return { data: cached as T, response: { ok: true, status: 200 } };
  }

  console.log(`[weather-cache] MISS: ${urlLabel(url)}`);

  // 2. For archive API URLs, route through consolidation buffer
  if (url.includes('archive-api.open-meteo.com')) {
    const parsed = parseArchiveUrl(url);
    if (parsed) {
      return new Promise<{ data: T; response: { ok: boolean; status: number } }>((resolve, reject) => {
        pendingArchive.push({
          originalUrl: url,
          lat: parsed.lat,
          lng: parsed.lng,
          startDate: parsed.startDate,
          endDate: parsed.endDate,
          fieldParams: parsed.fieldParams,
          resolve: resolve as (v: { data: unknown; response: { ok: boolean; status: number } }) => void,
          reject,
        });

        // Start or reset the consolidation timer
        if (consolidationTimer === null) {
          consolidationTimer = setTimeout(flushConsolidationBuffer, CONSOLIDATION_BUFFER_MS);
        }
      });
    }
  }

  // 3. Non-archive requests (forecast, current) go directly through the sequential queue
  return enqueue(async () => {
    const label = urlLabel(url);
    console.log(`[weather-queue] Processing request ${getQueuePosition()}`);

    const response = await fetchWithRetry(url, label);
    const data = await response.json() as T;

    if (response.ok) {
      writeToCache(url, data);
    }

    return { data, response: { ok: response.ok, status: response.status } };
  }) as Promise<{ data: T; response: { ok: boolean; status: number } }>;
}

// Initialize cache on module load
loadCacheIndex();
