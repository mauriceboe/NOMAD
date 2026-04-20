import { db } from '../db/database';
import { Trip, Place } from '../types';

// ── Admin-1 GeoJSON cache (sub-national regions) ─────────────────────────

let admin1GeoCache: any = null;
let admin1GeoLoading: Promise<any> | null = null;

async function loadAdmin1Geo(): Promise<any> {
  if (admin1GeoCache) return admin1GeoCache;
  if (admin1GeoLoading) return admin1GeoLoading;
  admin1GeoLoading = fetch(
    'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson',
    { headers: { 'User-Agent': 'TREK Travel Planner' } }
  ).then(r => r.json()).then(geo => {
    admin1GeoCache = geo;
    admin1GeoLoading = null;
    console.log(`[Atlas] Cached admin-1 GeoJSON: ${geo.features?.length || 0} features`);
    return geo;
  }).catch(err => {
    admin1GeoLoading = null;
    console.error('[Atlas] Failed to load admin-1 GeoJSON:', err);
    return null;
  });
  return admin1GeoLoading;
}

export async function getRegionGeo(countryCodes: string[]): Promise<any> {
  const geo = await loadAdmin1Geo();
  if (!geo) return { type: 'FeatureCollection', features: [] };
  const codes = new Set(countryCodes.map(c => c.toUpperCase()));
  const features = geo.features.filter((f: any) => codes.has(f.properties?.iso_a2?.toUpperCase()));
  return { type: 'FeatureCollection', features };
}

// ── Geocode cache ───────────────────────────────────────────────────────────

const geocodeCache = new Map<string, string | null>();

function roundKey(lat: number, lng: number): string {
  return `${lat.toFixed(3)},${lng.toFixed(3)}`;
}

function cacheKey(lat: number, lng: number): string {
  return roundKey(lat, lng);
}

export function getCached(lat: number, lng: number): string | null | undefined {
  const key = cacheKey(lat, lng);
  if (geocodeCache.has(key)) return geocodeCache.get(key)!;
  return undefined;
}

export function setCache(lat: number, lng: number, code: string | null): void {
  geocodeCache.set(cacheKey(lat, lng), code);
}

// Periodically trim the cache so it doesn't grow unbounded
const CACHE_MAX = 50_000;
const CACHE_CLEANUP_MS = 10 * 60 * 1000;
setInterval(() => {
  if (geocodeCache.size > CACHE_MAX) {
    const keys = [...geocodeCache.keys()];
    const toDelete = keys.slice(0, keys.length - CACHE_MAX);
    for (const k of toDelete) geocodeCache.delete(k);
  }
}, CACHE_CLEANUP_MS).unref();

// ── Bounding-box lookup tables ──────────────────────────────────────────────

export const COUNTRY_BOXES: Record<string, [number, number, number, number]> = {
  AF:[60.5,29.4,75,38.5],AL:[19,39.6,21.1,42.7],DZ:[-8.7,19,12,37.1],AD:[1.4,42.4,1.8,42.7],AO:[11.7,-18.1,24.1,-4.4],
  AR:[-73.6,-55.1,-53.6,-21.8],AM:[43.4,38.8,46.6,41.3],AU:[112.9,-43.6,153.6,-10.7],AT:[9.5,46.4,17.2,49],AZ:[44.8,38.4,50.4,41.9],
  BA:[15.7,42.6,19.6,45.3],BD:[88.0,20.7,92.7,26.6],BF:[-5.5,9.4,2.4,15.1],BH:[50.4,25.8,50.7,26.2],BI:[29.0,-4.5,30.8,-2.3],
  BJ:[0.8,6.2,3.8,12.4],BN:[114.1,4.0,115.4,5.1],BO:[-69.7,-22.9,-57.5,-9.7],BR:[-73.9,-33.8,-34.8,5.3],BE:[2.5,49.5,6.4,51.5],
  BG:[22.4,41.2,28.6,44.2],BW:[20.0,-26.9,29.4,-17.8],CA:[-141,41.7,-52.6,83.1],CD:[12.2,-13.5,31.3,5.4],CG:[11.2,-5.0,18.7,3.7],
  CI:[-8.6,4.3,-2.5,10.7],CL:[-75.6,-55.9,-66.9,-17.5],CM:[8.4,1.7,16.2,13.1],CN:[73.6,18.2,134.8,53.6],CO:[-79.1,-4.3,-66.9,12.5],
  CR:[-85.9,8.0,-82.5,11.2],CU:[-85.0,19.8,-74.1,23.2],CV:[-25.4,14.8,-22.7,17.2],CY:[32.3,34.5,34.1,35.7],HR:[13.5,42.4,19.5,46.6],
  CZ:[12.1,48.6,18.9,51.1],DJ:[41.8,11.0,43.4,12.7],DK:[8,54.6,15.2,57.8],DO:[-72.0,17.5,-68.3,19.9],EC:[-81.0,-5.0,-75.2,1.5],
  EG:[24.7,22,37,31.7],EE:[21.8,57.5,28.2,59.7],ER:[36.4,12.4,43.1,18.0],ET:[33.0,3.4,47.9,14.9],FI:[20.6,59.8,31.6,70.1],
  FR:[-5.1,41.3,9.6,51.1],DE:[5.9,47.3,15.1,55.1],GE:[40.0,41.0,46.7,43.6],GH:[-3.3,4.7,1.2,11.2],GN:[-15.1,7.2,-7.6,12.7],
  GR:[19.4,34.8,29.7,41.8],GT:[-92.2,13.7,-88.2,17.8],HN:[-89.4,12.9,-83.2,16.5],HT:[-74.5,18.0,-71.6,20.1],HU:[16,45.7,22.9,48.6],
  IS:[-24.5,63.4,-13.5,66.6],IN:[68.2,6.7,97.4,35.5],ID:[95.3,-11,141,5.9],IR:[44.1,25.1,63.3,39.8],IQ:[38.8,29.1,48.6,37.4],
  IE:[-10.5,51.4,-6,55.4],IL:[34.3,29.5,35.9,33.3],IT:[6.6,36.6,18.5,47.1],JM:[-78.4,17.7,-76.2,18.5],JO:[34.9,29.2,39.3,33.4],
  JP:[129.4,31.1,145.5,45.5],KE:[33.9,-4.7,41.9,5.5],KG:[69.2,39.2,80.3,43.2],KH:[102.3,10.4,107.6,14.7],KR:[126,33.2,129.6,38.6],
  KW:[46.5,28.5,48.4,30.1],KZ:[50.3,40.6,87.4,55.4],LA:[100.1,13.9,107.7,22.5],LB:[35.1,33.1,36.6,34.7],LK:[79.7,5.9,81.9,9.8],
  LV:[21,55.7,28.2,58.1],LT:[21,53.9,26.8,56.5],LU:[5.7,49.4,6.5,50.2],LY:[9.5,19.5,25.2,33.3],MA:[-13.2,27.7,-1,35.9],
  MD:[26.6,45.5,30.2,48.5],ME:[18.4,41.8,20.4,43.6],MG:[43.2,-25.6,50.5,-11.9],MK:[20.5,40.8,23.0,42.4],ML:[-4.8,10.1,4.3,25.0],
  MM:[92.2,9.8,101.2,28.5],MN:[87.8,41.6,119.9,52.1],MR:[-17.1,14.7,-4.8,27.3],MT:[14.1,35.8,14.6,36.1],MU:[57.3,-20.5,57.8,-19.9],
  MV:[72.7,-0.7,73.8,7.1],MW:[32.7,-17.1,35.9,-9.4],MY:[99.6,0.9,119.3,7.4],MX:[-118.4,14.5,-86.7,32.7],MZ:[30.2,-26.9,40.8,-10.5],
  NA:[11.7,-28.9,25.3,-17.0],NE:[0.2,11.7,15.9,23.5],NI:[-87.7,10.7,-83.1,15.0],NL:[3.4,50.8,7.2,53.5],NP:[80.1,26.4,88.2,30.4],
  NZ:[166.4,-47.3,178.5,-34.4],NO:[4.6,58,31.1,71.2],OM:[51.9,16.6,59.8,26.4],PA:[-83.0,7.2,-77.2,9.6],PG:[140.8,-11.7,155.7,-1.3],
  PK:[60.9,23.7,77.1,37.1],PE:[-81.3,-18.4,-68.7,-0.1],PH:[117,5,126.6,18.5],PL:[14.1,49,24.1,54.9],PS:[34.2,29.5,35.6,32.6],
  PT:[-9.5,36.8,-6.2,42.2],PY:[-62.6,-27.6,-54.3,-19.3],QA:[50.7,24.5,51.6,26.2],RO:[20.2,43.6,29.7,48.3],RU:[19.6,41.2,180,81.9],
  RW:[29.0,-2.8,30.9,-1.0],SA:[34.6,16.4,55.7,32.2],SC:[55.3,-9.7,55.8,-3.7],SD:[21.8,3.4,38.6,22.2],SG:[103.6,1.2,104.1,1.5],
  SI:[13.4,45.4,16.6,46.9],SK:[16.8,47.7,22.6,49.6],SN:[-17.5,12.3,-11.4,15.0],SO:[40.9,-1.7,51.4,11.9],RS:[18.8,42.2,23,46.2],
  SV:[-90.1,13.2,-87.7,14.5],SY:[35.7,32.3,42.4,37.3],TG:[-0.2,6.1,1.8,11.2],TJ:[67.3,36.7,75.2,41.0],TM:[52.4,35.1,66.7,42.8],
  TN:[7.5,30.2,11.6,37.5],TT:[-61.9,10.0,-60.5,11.3],TW:[120.1,21.9,122.0,25.3],TZ:[29.3,-11.7,40.4,-1.0],ZA:[16.5,-34.8,32.9,-22.1],
  SE:[11.1,55.3,24.2,69.1],CH:[6,45.8,10.5,47.8],TH:[97.3,5.6,105.6,20.5],TR:[26,36,44.8,42.1],UA:[22.1,44.4,40.2,52.4],
  UG:[29.6,-1.5,35.0,4.2],UY:[-58.4,-34.9,-53.1,-30.1],UZ:[55.9,37.2,73.1,45.6],VE:[-73.4,0.7,-59.8,12.2],
  AE:[51.6,22.6,56.4,26.1],GB:[-8,49.9,2,60.9],US:[-125,24.5,-66.9,49.4],VN:[102.1,8.6,109.5,23.4],XK:[20.0,41.9,21.8,43.3],
  YE:[42.5,12.1,54.0,19.0],ZM:[21.9,-18.1,33.7,-8.2],ZW:[25.2,-22.4,33.1,-15.6],
};

export const NAME_TO_CODE: Record<string, string> = {
  'germany':'DE','deutschland':'DE','france':'FR','frankreich':'FR','spain':'ES','spanien':'ES',
  'italy':'IT','italien':'IT','united kingdom':'GB','uk':'GB','england':'GB','united states':'US',
  'usa':'US','netherlands':'NL','niederlande':'NL','austria':'AT','osterreich':'AT','switzerland':'CH',
  'schweiz':'CH','portugal':'PT','greece':'GR','griechenland':'GR','turkey':'TR','turkei':'TR',
  'croatia':'HR','kroatien':'HR','czech republic':'CZ','tschechien':'CZ','czechia':'CZ',
  'poland':'PL','polen':'PL','sweden':'SE','schweden':'SE','norway':'NO','norwegen':'NO',
  'denmark':'DK','danemark':'DK','finland':'FI','finnland':'FI','belgium':'BE','belgien':'BE',
  'ireland':'IE','irland':'IE','hungary':'HU','ungarn':'HU','romania':'RO','rumanien':'RO',
  'bulgaria':'BG','bulgarien':'BG','japan':'JP','china':'CN','australia':'AU','australien':'AU',
  'canada':'CA','kanada':'CA','mexico':'MX','mexiko':'MX','brazil':'BR','brasilien':'BR',
  'argentina':'AR','argentinien':'AR','thailand':'TH','indonesia':'ID','indonesien':'ID',
  'india':'IN','indien':'IN','egypt':'EG','agypten':'EG','morocco':'MA','marokko':'MA',
  'south africa':'ZA','sudafrika':'ZA','new zealand':'NZ','neuseeland':'NZ','iceland':'IS','island':'IS',
  'luxembourg':'LU','luxemburg':'LU','slovenia':'SI','slowenien':'SI','slovakia':'SK','slowakei':'SK',
  'estonia':'EE','estland':'EE','latvia':'LV','lettland':'LV','lithuania':'LT','litauen':'LT',
  'serbia':'RS','serbien':'RS','israel':'IL','russia':'RU','russland':'RU','ukraine':'UA',
  'vietnam':'VN','south korea':'KR','sudkorea':'KR','philippines':'PH','philippinen':'PH',
  'malaysia':'MY','colombia':'CO','kolumbien':'CO','peru':'PE','chile':'CL','iran':'IR',
  'iraq':'IQ','irak':'IQ','pakistan':'PK','kenya':'KE','kenia':'KE','nigeria':'NG',
  'saudi arabia':'SA','saudi-arabien':'SA','albania':'AL','albanien':'AL',
  'georgia':'GE','georgien':'GE','montenegro':'ME','north macedonia':'MK','nordmazedonien':'MK',
  'macedonia':'MK','bosnia':'BA','bosnia and herzegovina':'BA','bosnien':'BA','kosovo':'XK',
  'cyprus':'CY','zypern':'CY','malta':'MT','tunisia':'TN','tunesien':'TN','jordan':'JO','jordanien':'JO',
  'lebanon':'LB','libanon':'LB','ghana':'GH','ethiopia':'ET','athiopien':'ET','tanzania':'TZ','uganda':'UG',
  'singapore':'SG','taiwan':'TW','nepal':'NP','sri lanka':'LK','cambodia':'KH','kambodscha':'KH',
  'myanmar':'MM','burma':'MM','laos':'LA','mongolia':'MN','mongolei':'MN','kazakhstan':'KZ','kasachstan':'KZ',
  'uzbekistan':'UZ','usbekistan':'UZ','kyrgyzstan':'KG','kirgisistan':'KG','tajikistan':'TJ','tadschikistan':'TJ',
  'turkmenistan':'TM','costa rica':'CR','panama':'PA','ecuador':'EC','uruguay':'UY','cuba':'CU','kuba':'CU',
  'dominican republic':'DO','dominikanische republik':'DO','jamaica':'JM','haiti':'HT','honduras':'HN',
  'guatemala':'GT','el salvador':'SV','nicaragua':'NI','bolivia':'BO','bolivia plurinational state of':'BO',
  'paraguay':'PY','venezuela':'VE','trinidad and tobago':'TT','trinidad':'TT',
  'oman':'OM','kuwait':'KW','qatar':'QA','bahrain':'BH',
  'syria':'SY','syrien':'SY','yemen':'YE','jemen':'YE','palestine':'PS','palastina':'PS',
  'moldova':'MD','republic of moldova':'MD','moldawien':'MD',
  'libya':'LY','libyen':'LY','sudan':'SD','eritrea':'ER','djibouti':'DJ',
  'senegal':'SN','cameroon':'CM','kamerun':'CM','ivory coast':'CI','cote d\'ivoire':'CI',
  'mali':'ML','niger':'NE','burkina faso':'BF','togo':'TG','benin':'BJ','guinea':'GN',
  'dr congo':'CD','democratic republic of the congo':'CD','republic of the congo':'CG','congo':'CG',
  'angola':'AO','namibia':'NA','botswana':'BW','zimbabwe':'ZW','zambia':'ZM','malawi':'MW',
  'mozambique':'MZ','mozambik':'MZ','madagascar':'MG','rwanda':'RW','burundi':'BI',
  'somalia':'SO','papua new guinea':'PG','brunei':'BN',
};

const US_STATE_CODES = new Set([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
  'DC',
]);

const US_COUNTRY_MARKERS = new Set([
  'united states',
  'united states of america',
  'usa',
  'us',
]);

export const CONTINENT_MAP: Record<string, string> = {
  AF:'Asia',AL:'Europe',DZ:'Africa',AD:'Europe',AO:'Africa',AR:'South America',AM:'Asia',AU:'Oceania',AT:'Europe',AZ:'Asia',
  BA:'Europe',BD:'Asia',BF:'Africa',BH:'Asia',BI:'Africa',BJ:'Africa',BN:'Asia',BO:'South America',
  BR:'South America',BE:'Europe',BG:'Europe',BW:'Africa',
  CA:'North America',CD:'Africa',CG:'Africa',CI:'Africa',CL:'South America',CM:'Africa',CN:'Asia',CO:'South America',
  CR:'North America',CU:'North America',CV:'Africa',CY:'Europe',HR:'Europe',CZ:'Europe',
  DJ:'Africa',DK:'Europe',DO:'North America',EC:'South America',EG:'Africa',EE:'Europe',ER:'Africa',ET:'Africa',
  FI:'Europe',FR:'Europe',DE:'Europe',GE:'Asia',GH:'Africa',GN:'Africa',GR:'Europe',GT:'North America',
  HN:'North America',HT:'North America',HU:'Europe',IS:'Europe',IN:'Asia',ID:'Asia',IR:'Asia',IQ:'Asia',
  IE:'Europe',IL:'Asia',IT:'Europe',JM:'North America',JO:'Asia',JP:'Asia',KE:'Africa',KG:'Asia',KH:'Asia',
  KR:'Asia',KW:'Asia',KZ:'Asia',LA:'Asia',LB:'Asia',LK:'Asia',LV:'Europe',LT:'Europe',LU:'Europe',LY:'Africa',
  MA:'Africa',MD:'Europe',ME:'Europe',MG:'Africa',MK:'Europe',ML:'Africa',MM:'Asia',MN:'Asia',MR:'Africa',
  MT:'Europe',MU:'Africa',MV:'Asia',MW:'Africa',MY:'Asia',MX:'North America',MZ:'Africa',
  NA:'Africa',NE:'Africa',NI:'North America',NL:'Europe',NP:'Asia',NZ:'Oceania',NO:'Europe',OM:'Asia',
  PA:'North America',PG:'Oceania',PK:'Asia',PE:'South America',PH:'Asia',PL:'Europe',PS:'Asia',
  PT:'Europe',PY:'South America',QA:'Asia',RO:'Europe',RU:'Europe',RW:'Africa',SA:'Asia',SC:'Africa',
  SD:'Africa',SG:'Asia',SI:'Europe',SK:'Europe',SN:'Africa',SO:'Africa',RS:'Europe',SV:'North America',
  SY:'Asia',TG:'Africa',TJ:'Asia',TM:'Asia',TN:'Africa',TT:'North America',TW:'Asia',TZ:'Africa',
  ZA:'Africa',SE:'Europe',CH:'Europe',TH:'Asia',TR:'Europe',UA:'Europe',UG:'Africa',UY:'South America',
  UZ:'Asia',VE:'South America',AE:'Asia',GB:'Europe',US:'North America',VN:'Asia',XK:'Europe',
  YE:'Asia',ZM:'Africa',ZW:'Africa',NG:'Africa',
};

// ── Geocoding helpers ───────────────────────────────────────────────────────

let lastNominatimCall = 0;

// Shared throttle: enforces ≥1.1s between any Nominatim request, across all callers.
async function throttleNominatim() {
  const elapsed = Date.now() - lastNominatimCall;
  if (elapsed < 1100) await new Promise(r => setTimeout(r, 1100 - elapsed));
  lastNominatimCall = Date.now();
}

export async function reverseGeocodeCountry(lat: number, lng: number): Promise<string | null> {
  const key = roundKey(lat, lng);
  if (geocodeCache.has(key)) return geocodeCache.get(key)!;
  await throttleNominatim();
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=3&accept-language=en`, {
      headers: { 'User-Agent': 'TREK Travel Planner (https://github.com/mauriceboe/TREK)' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const data = await res.json() as { address?: { country_code?: string } };
    const code = data.address?.country_code?.toUpperCase() || null;
    geocodeCache.set(key, code);
    return code;
  } catch {
    return null;
  }
}

export function getCountryFromCoords(lat: number, lng: number): string | null {
  let bestCode: string | null = null;
  let bestArea = Infinity;
  for (const [code, [minLng, minLat, maxLng, maxLat]] of Object.entries(COUNTRY_BOXES)) {
    if (lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng) {
      const area = (maxLng - minLng) * (maxLat - minLat);
      if (area < bestArea) {
        bestArea = area;
        bestCode = code;
      }
    }
  }
  return bestCode;
}

export function getCountryFromAddress(address: string | null): string | null {
  if (!address) return null;
  const parts = address.split(',').map(s => s.trim()).filter(Boolean);
  if (parts.length === 0) return null;
  const last = parts[parts.length - 1];
  const normalized = last.toLowerCase();
  if (NAME_TO_CODE[normalized]) return NAME_TO_CODE[normalized];
  if (NAME_TO_CODE[last]) return NAME_TO_CODE[last];
  if (US_COUNTRY_MARKERS.has(normalized)) return 'US';

  const stateMatch = last.match(/\b([A-Z]{2})\b(?:\s+\d{5}(?:-\d{4})?)?$/);
  if (stateMatch && US_STATE_CODES.has(stateMatch[1]) && parts.length > 1) return 'US';

  if (last.length === 2 && last === last.toUpperCase()) {
    if (US_STATE_CODES.has(last) && parts.length > 1) return 'US';
    return last;
  }
  return null;
}

// ── Resolve a place to a country code (address -> bbox -> geocode) ──────────

function getStoredCountryCode(placeId: number): string | null {
  const row = db.prepare('SELECT country_code FROM place_regions WHERE place_id = ?').get(placeId) as { country_code: string } | undefined;
  return row?.country_code ?? null;
}

async function resolveCountryCode(place: Place): Promise<string | null> {
  let code = getStoredCountryCode(place.id);
  if (!code) {
    code = getCountryFromAddress(place.address);
  }
  if (!code && place.lat && place.lng) {
    code = getCountryFromCoords(place.lat, place.lng);
  }
  if (!code && place.lat && place.lng) {
    code = await reverseGeocodeCountry(place.lat, place.lng);
  }
  return code;
}

function resolveCountryCodeSync(place: Place): string | null {
  let code = getStoredCountryCode(place.id);
  if (!code) {
    code = getCountryFromAddress(place.address);
  }
  if (!code && place.lat && place.lng) {
    code = getCountryFromCoords(place.lat, place.lng);
  }
  return code;
}

// ── Shared query: all trips the user owns or is a member of ─────────────────

function getUserTrips(userId: number): Trip[] {
  return db.prepare(`
    SELECT DISTINCT t.* FROM trips t
    LEFT JOIN trip_members m ON m.trip_id = t.id AND m.user_id = ?
    WHERE t.user_id = ? OR m.user_id = ?
    ORDER BY t.start_date DESC
  `).all(userId, userId, userId) as Trip[];
}

function getPlacesForTrips(tripIds: number[]): Place[] {
  if (tripIds.length === 0) return [];
  const placeholders = tripIds.map(() => '?').join(',');
  return db.prepare(`SELECT * FROM places WHERE trip_id IN (${placeholders})`).all(...tripIds) as Place[];
}

// ── Country resolution (batch DB cache + sync fallback + background geocoding) ──

function resolvePlaceCountries(places: Place[]): Map<number, string> {
  const out = new Map<number, string>();
  const geoPlaces = places.filter(p => p.lat && p.lng);
  const placeIds = geoPlaces.map(p => p.id);

  const cached = placeIds.length > 0
    ? (db.prepare(
        `SELECT place_id, country_code FROM place_regions WHERE place_id IN (${placeIds.map(() => '?').join(',')})`
      ).all(...placeIds) as { place_id: number; country_code: string }[])
    : [];
  const cachedMap = new Map(cached.map(r => [r.place_id, r.country_code]));

  const uncachedForGeocode: Place[] = [];
  for (const p of places) {
    const fromDb = cachedMap.get(p.id);
    if (fromDb) { out.set(p.id, fromDb); continue; }
    const sync = resolveCountryCodeSync(p);
    if (sync) { out.set(p.id, sync); continue; }
    if (p.lat && p.lng && !geocodingInFlight.has(p.id)) {
      uncachedForGeocode.push(p);
    }
  }

  if (uncachedForGeocode.length > 0) {
    const insertStmt = db.prepare(
      'INSERT OR REPLACE INTO place_regions (place_id, country_code, region_code, region_name) VALUES (?, ?, ?, ?)'
    );
    for (const p of uncachedForGeocode) geocodingInFlight.add(p.id);
    void (async () => {
      try {
        for (const place of uncachedForGeocode) {
          try {
            const info = await reverseGeocodeRegion(place.lat!, place.lng!);
            if (info) insertStmt.run(place.id, info.country_code, info.region_code, info.region_name);
          } catch { /* continue */ }
          finally { geocodingInFlight.delete(place.id); }
        }
      } catch {
        for (const p of uncachedForGeocode) geocodingInFlight.delete(p.id);
      }
    })();
  }

  return out;
}

// ── getStats ────────────────────────────────────────────────────────────────

export async function getStats(userId: number) {
  const trips = getUserTrips(userId);
  const tripIds = trips.map(t => t.id);

  if (tripIds.length === 0) {
    const manualCountries = db.prepare('SELECT country_code FROM visited_countries WHERE user_id = ?').all(userId) as { country_code: string }[];
    const countries = manualCountries.map(mc => ({ code: mc.country_code, placeCount: 0, tripCount: 0, firstVisit: null, lastVisit: null }));
    return { countries, trips: [], stats: { totalTrips: 0, totalPlaces: 0, totalCountries: countries.length, totalDays: 0 } };
  }

  const places = getPlacesForTrips(tripIds);

  interface CountryEntry { code: string; places: { id: number; name: string; lat: number | null; lng: number | null }[]; tripIds: Set<number> }
  const placeCountries = resolvePlaceCountries(places);
  const countrySet = new Map<string, CountryEntry>();
  for (const place of places) {
    const code = placeCountries.get(place.id);
    if (code) {
      if (!countrySet.has(code)) {
        countrySet.set(code, { code, places: [], tripIds: new Set() });
      }
      countrySet.get(code)!.places.push({ id: place.id, name: place.name, lat: place.lat ?? null, lng: place.lng ?? null });
      countrySet.get(code)!.tripIds.add(place.trip_id);
    }
  }

  let totalDays = 0;
  for (const trip of trips) {
    if (trip.start_date && trip.end_date) {
      const start = new Date(trip.start_date);
      const end = new Date(trip.end_date);
      const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      if (diff > 0) totalDays += diff;
    }
  }

  const countries = [...countrySet.values()].map(c => {
    const countryTrips = trips.filter(t => c.tripIds.has(t.id));
    const dates = countryTrips.map(t => t.start_date).filter(Boolean).sort();
    return {
      code: c.code,
      placeCount: c.places.length,
      tripCount: c.tripIds.size,
      firstVisit: dates[0] || null,
      lastVisit: dates[dates.length - 1] || null,
    };
  });

  const citySet = new Set<string>();
  for (const place of places) {
    if (place.address) {
      const parts = place.address.split(',').map((s: string) => s.trim()).filter(Boolean);
      let raw = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
      if (raw) {
        const city = raw.replace(/[\d\-\u2212\u3012]+/g, '').trim().toLowerCase();
        if (city) citySet.add(city);
      }
    }
  }
  const totalCities = citySet.size;

  // Merge manually marked countries
  const manualCountries = db.prepare('SELECT country_code FROM visited_countries WHERE user_id = ?').all(userId) as { country_code: string }[];
  for (const mc of manualCountries) {
    if (!countries.find(c => c.code === mc.country_code)) {
      countries.push({ code: mc.country_code, placeCount: 0, tripCount: 0, firstVisit: null, lastVisit: null });
    }
  }

  const mostVisited = countries.length > 0 ? countries.reduce((a, b) => a.placeCount > b.placeCount ? a : b) : null;

  const continents: Record<string, number> = {};
  countries.forEach(c => {
    const cont = CONTINENT_MAP[c.code] || 'Other';
    continents[cont] = (continents[cont] || 0) + 1;
  });

  const now = new Date().toISOString().split('T')[0];
  const pastTrips = trips.filter(t => t.end_date && t.end_date <= now).sort((a, b) => b.end_date!.localeCompare(a.end_date!));
  const lastTrip: { id: number; title: string; start_date?: string | null; end_date?: string | null; countryCode?: string } | null = pastTrips[0]
    ? { id: pastTrips[0].id, title: pastTrips[0].title, start_date: pastTrips[0].start_date, end_date: pastTrips[0].end_date }
    : null;
  if (lastTrip) {
    const lastTripPlaces = places.filter(p => p.trip_id === lastTrip.id);
    for (const p of lastTripPlaces) {
      const code = resolveCountryCodeSync(p);
      if (code) { lastTrip.countryCode = code; break; }
    }
  }

  const futureTrips = trips.filter(t => t.start_date && t.start_date > now).sort((a, b) => a.start_date!.localeCompare(b.start_date!));
  const nextTrip: { id: number; title: string; start_date?: string | null; daysUntil?: number } | null = futureTrips[0]
    ? { id: futureTrips[0].id, title: futureTrips[0].title, start_date: futureTrips[0].start_date }
    : null;
  if (nextTrip) {
    const diff = Math.ceil((new Date(nextTrip.start_date!).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    nextTrip.daysUntil = Math.max(0, diff);
  }

  const tripYears = new Set(trips.filter(t => t.start_date).map(t => parseInt(t.start_date!.split('-')[0])));
  let streak = 0;
  const currentYear = new Date().getFullYear();
  for (let y = currentYear; y >= 2000; y--) {
    if (tripYears.has(y)) streak++;
    else break;
  }
  const firstYear = tripYears.size > 0 ? Math.min(...tripYears) : null;

  return {
    countries,
    stats: {
      totalTrips: trips.length,
      totalPlaces: places.length,
      totalCountries: countries.length,
      totalDays,
      totalCities,
    },
    mostVisited,
    continents,
    lastTrip,
    nextTrip,
    streak,
    firstYear,
    tripsThisYear: trips.filter(t => t.start_date && t.start_date.startsWith(String(currentYear))).length,
  };
}

// ── getCountryPlaces ────────────────────────────────────────────────────────

export function getCountryPlaces(userId: number, code: string) {
  const trips = getUserTrips(userId);
  const tripIds = trips.map(t => t.id);
  if (tripIds.length === 0) return { places: [], trips: [], manually_marked: false };

  const places = getPlacesForTrips(tripIds);

  const matchingPlaces: { id: number; name: string; address: string | null; lat: number | null; lng: number | null; trip_id: number }[] = [];
  const matchingTripIds = new Set<number>();

  for (const place of places) {
    const pCode = resolveCountryCodeSync(place);
    if (pCode === code) {
      matchingPlaces.push({ id: place.id, name: place.name, address: place.address ?? null, lat: place.lat ?? null, lng: place.lng ?? null, trip_id: place.trip_id });
      matchingTripIds.add(place.trip_id);
    }
  }

  const matchingTrips = trips.filter(t => matchingTripIds.has(t.id)).map(t => ({ id: t.id, title: t.title, start_date: t.start_date, end_date: t.end_date }));

  const isManuallyMarked = !!(db.prepare('SELECT 1 FROM visited_countries WHERE user_id = ? AND country_code = ?').get(userId, code));
  return { places: matchingPlaces, trips: matchingTrips, manually_marked: isManuallyMarked };
}

// ── Mark / unmark country ───────────────────────────────────────────────────

export function listVisitedCountries(userId: number): { country_code: string; created_at: string }[] {
  return db.prepare(
    'SELECT country_code, created_at FROM visited_countries WHERE user_id = ? ORDER BY created_at DESC'
  ).all(userId) as { country_code: string; created_at: string }[];
}

export function markCountryVisited(userId: number, code: string): void {
  db.prepare('INSERT OR IGNORE INTO visited_countries (user_id, country_code) VALUES (?, ?)').run(userId, code);
}

export function unmarkCountryVisited(userId: number, code: string): void {
  db.prepare('DELETE FROM visited_countries WHERE user_id = ? AND country_code = ?').run(userId, code);
  db.prepare('DELETE FROM visited_regions WHERE user_id = ? AND country_code = ?').run(userId, code);
}

// ── Mark / unmark region ────────────────────────────────────────────────────

export function listManuallyVisitedRegions(userId: number): { region_code: string; region_name: string; country_code: string }[] {
  return db.prepare(
    'SELECT region_code, region_name, country_code FROM visited_regions WHERE user_id = ? ORDER BY created_at DESC'
  ).all(userId) as { region_code: string; region_name: string; country_code: string }[];
}

export function markRegionVisited(userId: number, regionCode: string, regionName: string, countryCode: string): void {
  db.prepare('INSERT OR IGNORE INTO visited_regions (user_id, region_code, region_name, country_code) VALUES (?, ?, ?, ?)').run(userId, regionCode, regionName, countryCode);
  // Auto-mark parent country if not already visited
  db.prepare('INSERT OR IGNORE INTO visited_countries (user_id, country_code) VALUES (?, ?)').run(userId, countryCode);
}

export function unmarkRegionVisited(userId: number, regionCode: string): void {
  const region = db.prepare('SELECT country_code FROM visited_regions WHERE user_id = ? AND region_code = ?').get(userId, regionCode) as { country_code: string } | undefined;
  db.prepare('DELETE FROM visited_regions WHERE user_id = ? AND region_code = ?').run(userId, regionCode);
  if (region) {
    const remaining = db.prepare('SELECT COUNT(*) as count FROM visited_regions WHERE user_id = ? AND country_code = ?').get(userId, region.country_code) as { count: number };
    if (remaining.count === 0) {
      db.prepare('DELETE FROM visited_countries WHERE user_id = ? AND country_code = ?').run(userId, region.country_code);
    }
  }
}

// ── Sub-national region resolution ────────────────────────────────────────

interface RegionInfo { country_code: string; region_code: string; region_name: string }

// Tracks place IDs currently being geocoded in the background to prevent duplicate enqueuing.
const geocodingInFlight = new Set<number>();

const regionCache = new Map<string, RegionInfo | null>();

async function reverseGeocodeRegion(lat: number, lng: number): Promise<RegionInfo | null> {
  const key = roundKey(lat, lng);
  if (regionCache.has(key)) return regionCache.get(key)!;
  await throttleNominatim();
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=8&accept-language=en`,
      {
        headers: { 'User-Agent': 'TREK Travel Planner (https://github.com/mauriceboe/TREK)' },
        signal: AbortSignal.timeout(10_000),
      }
    );
    if (!res.ok) return null;
    const data = await res.json() as { address?: Record<string, string> };
    const countryCode = data.address?.country_code?.toUpperCase() || null;
    // Try finest ISO level first (lvl6 = departments/provinces), then lvl5, then lvl4 (states/regions)
    let regionCode = data.address?.['ISO3166-2-lvl6'] || data.address?.['ISO3166-2-lvl5'] || data.address?.['ISO3166-2-lvl4'] || null;
    // Normalize: FR-75C → FR-75 (strip trailing letter suffixes for GeoJSON compatibility)
    if (regionCode && /^[A-Z]{2}-\d+[A-Z]$/i.test(regionCode)) {
      regionCode = regionCode.replace(/[A-Z]$/i, '');
    }
    const regionName = data.address?.state || data.address?.province || data.address?.region || data.address?.county || data.address?.city || null;
    if (!countryCode || !regionName) { regionCache.set(key, null); return null; }
    const info: RegionInfo = {
      country_code: countryCode,
      region_code: regionCode || `${countryCode}-${regionName.substring(0, 3).toUpperCase()}`,
      region_name: regionName,
    };
    regionCache.set(key, info);
    return info;
  } catch {
    return null;
  }
}

export async function getVisitedRegions(userId: number): Promise<{ regions: Record<string, { code: string; name: string; placeCount: number }[]> }> {
  const trips = getUserTrips(userId);
  const tripIds = trips.map(t => t.id);
  const places = getPlacesForTrips(tripIds);

  // Check DB cache first
  const placeIds = places.filter(p => p.lat && p.lng).map(p => p.id);
  const cached = placeIds.length > 0
    ? db.prepare(`SELECT * FROM place_regions WHERE place_id IN (${placeIds.map(() => '?').join(',')})`).all(...placeIds) as { place_id: number; country_code: string; region_code: string; region_name: string }[]
    : [];
  const cachedMap = new Map(cached.map(c => [c.place_id, c]));

  // Kick off background geocoding for uncached places; return cached data immediately.
  const uncached = places.filter(p => p.lat && p.lng && !cachedMap.has(p.id) && !geocodingInFlight.has(p.id));
  if (uncached.length > 0) {
    const insertStmt = db.prepare('INSERT OR REPLACE INTO place_regions (place_id, country_code, region_code, region_name) VALUES (?, ?, ?, ?)');
    for (const p of uncached) geocodingInFlight.add(p.id);
    void (async () => {
      try {
        for (const place of uncached) {
          try {
            const info = await reverseGeocodeRegion(place.lat!, place.lng!);
            if (info) insertStmt.run(place.id, info.country_code, info.region_code, info.region_name);
          } catch {
            // individual failure — continue with remaining places
          } finally {
            geocodingInFlight.delete(place.id);
          }
        }
      } catch {
        for (const p of uncached) geocodingInFlight.delete(p.id);
      }
    })();
  }

  // Group by country → regions with place counts
  const regionMap: Record<string, Map<string, { code: string; name: string; placeCount: number }>> = {};
  for (const [, entry] of cachedMap) {
    if (!regionMap[entry.country_code]) regionMap[entry.country_code] = new Map();
    const existing = regionMap[entry.country_code].get(entry.region_code);
    if (existing) {
      existing.placeCount++;
    } else {
      regionMap[entry.country_code].set(entry.region_code, { code: entry.region_code, name: entry.region_name, placeCount: 1 });
    }
  }

  const result: Record<string, { code: string; name: string; placeCount: number; manuallyMarked?: boolean }[]> = {};
  for (const [country, regions] of Object.entries(regionMap)) {
    result[country] = [...regions.values()];
  }

  // Merge manually marked regions
  const manualRegions = listManuallyVisitedRegions(userId);
  for (const r of manualRegions) {
    if (!result[r.country_code]) result[r.country_code] = [];
    if (!result[r.country_code].find(x => x.code === r.region_code)) {
      result[r.country_code].push({ code: r.region_code, name: r.region_name, placeCount: 0, manuallyMarked: true });
    }
  }

  return { regions: result };
}

// ── Bucket list CRUD ────────────────────────────────────────────────────────

export function listBucketList(userId: number) {
  return db.prepare('SELECT * FROM bucket_list WHERE user_id = ? ORDER BY created_at DESC').all(userId);
}

export function createBucketItem(userId: number, data: { name: string; lat?: number | null; lng?: number | null; country_code?: string | null; notes?: string | null; target_date?: string | null }) {
  const result = db.prepare('INSERT INTO bucket_list (user_id, name, lat, lng, country_code, notes, target_date) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
    userId, data.name.trim(), data.lat ?? null, data.lng ?? null, data.country_code ?? null, data.notes ?? null, data.target_date ?? null
  );
  return db.prepare('SELECT * FROM bucket_list WHERE id = ?').get(result.lastInsertRowid);
}

export function updateBucketItem(userId: number, itemId: string | number, data: { name?: string; notes?: string; lat?: number | null; lng?: number | null; country_code?: string | null; target_date?: string | null }) {
  const item = db.prepare('SELECT * FROM bucket_list WHERE id = ? AND user_id = ?').get(itemId, userId);
  if (!item) return null;
  db.prepare(`UPDATE bucket_list SET
    name = COALESCE(?, name),
    notes = CASE WHEN ? THEN ? ELSE notes END,
    lat = CASE WHEN ? THEN ? ELSE lat END,
    lng = CASE WHEN ? THEN ? ELSE lng END,
    country_code = CASE WHEN ? THEN ? ELSE country_code END,
    target_date = CASE WHEN ? THEN ? ELSE target_date END
    WHERE id = ?`).run(
    data.name?.trim() || null,
    data.notes !== undefined ? 1 : 0, data.notes !== undefined ? (data.notes || null) : null,
    data.lat !== undefined ? 1 : 0, data.lat !== undefined ? (data.lat || null) : null,
    data.lng !== undefined ? 1 : 0, data.lng !== undefined ? (data.lng || null) : null,
    data.country_code !== undefined ? 1 : 0, data.country_code !== undefined ? (data.country_code || null) : null,
    data.target_date !== undefined ? 1 : 0, data.target_date !== undefined ? (data.target_date || null) : null,
    itemId
  );
  return db.prepare('SELECT * FROM bucket_list WHERE id = ?').get(itemId);
}

export function deleteBucketItem(userId: number, itemId: string | number): boolean {
  const item = db.prepare('SELECT * FROM bucket_list WHERE id = ? AND user_id = ?').get(itemId, userId);
  if (!item) return false;
  db.prepare('DELETE FROM bucket_list WHERE id = ?').run(itemId);
  return true;
}
