import { db } from '../db/database';
import { getAssignmentsForDay } from './dayService';
import { getDetailedWeather } from './weatherService';

interface TripRow {
  id: number;
  title: string;
  start_date: string | null;
  end_date: string | null;
}

interface PlannerPlace {
  id: number;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  duration_minutes: number | null;
  category: string | null;
}

interface ExistingDayRow {
  id: number;
  day_number: number;
  date: string | null;
  title: string | null;
  assignment_count: number;
}

interface DaySlot {
  key: string;
  existingDayId: number | null;
  dayNumber: number;
  date: string | null;
}

interface PlannerOptions {
  pace?: 'packed' | 'normal' | 'relaxed';
  day_count?: number | null;
}

interface ClusterPlace extends PlannerPlace {
  lat: number;
  lng: number;
  duration_minutes: number;
  outdoor_bias: number;
}

interface OrderedCluster {
  title: string;
  total_minutes: number;
  outdoor_bias: number;
  centroid: { lat: number; lng: number };
  places: Array<ClusterPlace & { distance_from_previous_km: number | null }>;
}

const PACE_CONFIG = {
  packed: { placesPerDay: 7, targetMinutes: 540 },
  normal: { placesPerDay: 5, targetMinutes: 420 },
  relaxed: { placesPerDay: 3, targetMinutes: 300 },
} as const;

function parsePace(value: unknown): keyof typeof PACE_CONFIG {
  return value === 'packed' || value === 'relaxed' || value === 'normal' ? value : 'normal';
}

function addDays(dateStr: string, offset: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

function daysBetweenInclusive(start: string, end: string): number {
  const a = new Date(start);
  const b = new Date(end);
  const diff = Math.round((b.getTime() - a.getTime()) / 86400000);
  return diff >= 0 ? diff + 1 : 0;
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const aa =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
}

function averageCentroid(places: Array<{ lat: number; lng: number }>): { lat: number; lng: number } {
  const total = places.reduce((acc, place) => ({ lat: acc.lat + place.lat, lng: acc.lng + place.lng }), { lat: 0, lng: 0 });
  return { lat: total.lat / places.length, lng: total.lng / places.length };
}

function inferOutdoorBias(place: PlannerPlace): number {
  const text = `${place.category || ''} ${place.name} ${place.address || ''}`.toLowerCase();
  const outdoor = ['park', 'beach', 'viewpoint', 'trail', 'hike', 'garden', 'marina', 'square', 'plaza', 'zoo', 'market'];
  const indoor = ['museum', 'gallery', 'church', 'restaurant', 'cafe', 'bar', 'mall', 'shopping', 'spa', 'cinema', 'hotel'];
  if (outdoor.some(token => text.includes(token))) return 1;
  if (indoor.some(token => text.includes(token))) return -1;
  return 0;
}

function defaultDuration(place: PlannerPlace): number {
  const text = `${place.category || ''} ${place.name}`.toLowerCase();
  if (text.includes('museum') || text.includes('gallery')) return 150;
  if (text.includes('restaurant') || text.includes('cafe') || text.includes('bar')) return 90;
  if (text.includes('park') || text.includes('beach') || text.includes('garden')) return 120;
  if (text.includes('church') || text.includes('temple') || text.includes('cathedral')) return 60;
  if (text.includes('viewpoint') || text.includes('landmark') || text.includes('square')) return 45;
  return 75;
}

function buildTitle(cluster: ClusterPlace[]): string {
  const categoryCounts = new Map<string, number>();
  cluster.forEach(place => {
    const category = place.category || 'Explore';
    categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);
  });
  const topCategory = [...categoryCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0];
  const anchor = cluster[0]?.name || 'Day Plan';
  if (topCategory && topCategory !== 'Explore') return `${topCategory} Day`;
  return anchor.length > 28 ? `${anchor.slice(0, 25)}...` : anchor;
}

function orderCluster(places: ClusterPlace[]): OrderedCluster {
  const remaining = [...places].sort((a, b) => a.lng - b.lng || a.lat - b.lat || a.id - b.id);
  const ordered: Array<ClusterPlace & { distance_from_previous_km: number | null }> = [];
  let current = remaining.shift()!;
  ordered.push({ ...current, distance_from_previous_km: null });

  while (remaining.length > 0) {
    let bestIndex = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let i = 0; i < remaining.length; i++) {
      const distance = haversineKm(current, remaining[i]);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = i;
      }
    }
    current = remaining.splice(bestIndex, 1)[0];
    ordered.push({ ...current, distance_from_previous_km: Math.round(bestDistance * 10) / 10 });
  }

  const travelMinutes = ordered.reduce((sum, place) => sum + Math.min(90, Math.round(((place.distance_from_previous_km || 0) * 15))), 0);
  const visitMinutes = ordered.reduce((sum, place) => sum + place.duration_minutes, 0);
  return {
    title: buildTitle(places),
    total_minutes: visitMinutes + travelMinutes,
    outdoor_bias: places.reduce((sum, place) => sum + place.outdoor_bias, 0) / places.length,
    centroid: averageCentroid(places),
    places: ordered,
  };
}

function chooseSeeds(places: ClusterPlace[], count: number): ClusterPlace[] {
  const sorted = [...places].sort((a, b) => a.lng - b.lng || a.lat - b.lat || a.id - b.id);
  const seeds = [sorted[0]];
  while (seeds.length < count) {
    let best = sorted[0];
    let bestDistance = -1;
    for (const place of sorted) {
      const nearestSeedDistance = Math.min(...seeds.map(seed => haversineKm(place, seed)));
      if (nearestSeedDistance > bestDistance) {
        bestDistance = nearestSeedDistance;
        best = place;
      }
    }
    if (!seeds.some(seed => seed.id === best.id)) seeds.push(best);
    else break;
  }
  return seeds;
}

function buildClusters(places: ClusterPlace[], requestedDayCount: number, pace: keyof typeof PACE_CONFIG): OrderedCluster[] {
  const count = Math.max(1, Math.min(requestedDayCount, places.length));
  const seeds = chooseSeeds(places, count);
  const clusters: ClusterPlace[][] = Array.from({ length: seeds.length }, () => []);
  const targetMinutes = PACE_CONFIG[pace].targetMinutes;

  const sorted = [...places].sort((a, b) => b.duration_minutes - a.duration_minutes || a.id - b.id);
  for (const place of sorted) {
    const ranked = seeds
      .map((seed, index) => ({
        index,
        distance: haversineKm(place, seed),
        load: clusters[index].reduce((sum, item) => sum + item.duration_minutes, 0),
      }))
      .sort((a, b) => a.distance - b.distance || a.load - b.load);

    let target = ranked[0];
    const alternative = ranked.find(candidate =>
      candidate.load < targetMinutes * 0.9 &&
      candidate.distance <= target.distance * 1.35
    );
    if (alternative) target = alternative;
    clusters[target.index].push(place);
  }

  return clusters.filter(cluster => cluster.length > 0).map(orderCluster);
}

function buildDaySlots(trip: TripRow, days: ExistingDayRow[], count: number): DaySlot[] {
  const slots: DaySlot[] = [];
  const emptyDays = days.filter(day => day.assignment_count === 0).sort((a, b) => a.day_number - b.day_number);
  const maxDayNumber = days.reduce((max, day) => Math.max(max, day.day_number), 0);

  for (let i = 0; i < count; i++) {
    const existing = emptyDays[i];
    if (existing) {
      slots.push({
        key: `existing-${existing.id}`,
        existingDayId: existing.id,
        dayNumber: existing.day_number,
        date: existing.date,
      });
      continue;
    }
    const dayNumber = maxDayNumber + (i - emptyDays.length) + 1;
    let date: string | null = null;
    if (trip.start_date) date = addDays(trip.start_date, dayNumber - 1);
    slots.push({
      key: `new-${dayNumber}`,
      existingDayId: null,
      dayNumber,
      date,
    });
  }

  return slots;
}

function weatherSuitability(weather: { main: string; precipitation_sum?: number; precipitation_probability_max?: number; temp?: number } | null): number {
  if (!weather) return 0;
  let score = 0;
  if (weather.main === 'Clear') score += 3;
  if (weather.main === 'Clouds') score += 1;
  if (weather.main === 'Rain' || weather.main === 'Drizzle') score -= 3;
  score -= (weather.precipitation_probability_max || 0) / 20;
  score -= (weather.precipitation_sum || 0) / 2;
  if ((weather.temp || 0) >= 16 && (weather.temp || 0) <= 28) score += 1;
  return score;
}

async function attachWeather(clusters: OrderedCluster[], slots: DaySlot[]) {
  const slotWeather = await Promise.all(slots.map(async (slot) => {
    if (!slot.date) return null;
    try {
      const centroid = averageCentroid(clusters.map(cluster => cluster.centroid));
      const weather = await getDetailedWeather(String(centroid.lat), String(centroid.lng), slot.date, 'en');
      return {
        main: weather.main,
        temp: weather.temp,
        precipitation_sum: weather.precipitation_sum,
        precipitation_probability_max: weather.precipitation_probability_max,
        type: weather.type,
      };
    } catch {
      return null;
    }
  }));

  const clusterOrder = clusters
    .map((cluster, index) => ({ index, score: cluster.outdoor_bias }))
    .sort((a, b) => b.score - a.score || a.index - b.index);

  const slotOrder = slots
    .map((slot, index) => ({ index, score: weatherSuitability(slotWeather[index]) }))
    .sort((a, b) => b.score - a.score || a.index - b.index);

  const mapping = new Map<number, number>();
  clusterOrder.forEach((cluster, idx) => {
    mapping.set(cluster.index, slotOrder[idx]?.index ?? cluster.index);
  });

  return clusters.map((cluster, index) => {
    const slotIndex = mapping.get(index) ?? index;
    return {
      slot: slots[slotIndex],
      weather: slotWeather[slotIndex],
      cluster,
    };
  }).sort((a, b) => a.slot.dayNumber - b.slot.dayNumber);
}

function loadTripContext(tripId: number | string) {
  const trip = db.prepare('SELECT id, title, start_date, end_date FROM trips WHERE id = ?').get(tripId) as TripRow | undefined;
  if (!trip) throw new Error('Trip not found');

  const days = db.prepare(`
    SELECT d.id, d.day_number, d.date, d.title, COUNT(a.id) as assignment_count
    FROM days d
    LEFT JOIN day_assignments a ON a.day_id = d.id
    WHERE d.trip_id = ?
    GROUP BY d.id
    ORDER BY d.day_number ASC
  `).all(tripId) as ExistingDayRow[];

  const places = db.prepare(`
    SELECT p.id, p.name, p.address, p.lat, p.lng, p.duration_minutes, c.name as category
    FROM places p
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE p.trip_id = ?
      AND NOT EXISTS (SELECT 1 FROM day_assignments a WHERE a.place_id = p.id)
    ORDER BY p.created_at ASC, p.id ASC
  `).all(tripId) as PlannerPlace[];

  return { trip, days, places };
}

export async function generateItineraryPreview(tripId: number | string, options: PlannerOptions) {
  const { trip, days, places } = loadTripContext(tripId);
  const pace = parsePace(options.pace);

  const leftovers: Array<{ id: number; name: string; reason: string }> = [];
  const geoPlaces: ClusterPlace[] = [];

  for (const place of places) {
    if (place.lat == null || place.lng == null) {
      leftovers.push({ id: place.id, name: place.name, reason: 'Missing coordinates' });
      continue;
    }
    geoPlaces.push({
      ...place,
      lat: place.lat,
      lng: place.lng,
      duration_minutes: place.duration_minutes || defaultDuration(place),
      outdoor_bias: inferOutdoorBias(place),
    });
  }

  const rangeDayCount = trip.start_date && trip.end_date ? daysBetweenInclusive(trip.start_date, trip.end_date) : 0;
  const derivedDayCount = Math.ceil(Math.max(1, geoPlaces.length) / PACE_CONFIG[pace].placesPerDay);
  const requested = typeof options.day_count === 'number' && options.day_count > 0
    ? Math.round(options.day_count)
    : derivedDayCount;
  const boundedToTripRange = rangeDayCount > 0 ? Math.min(requested, rangeDayCount) : requested;
  const requestedDayCount = Math.max(1, Math.min(boundedToTripRange, Math.max(geoPlaces.length, 1)));

  if (geoPlaces.length === 0) {
    return {
      preview: {
        pace,
        requested_day_count: requestedDayCount,
        generated_days: [],
        leftovers,
      }
    };
  }

  const clusters = buildClusters(geoPlaces, requestedDayCount, pace);
  const slots = buildDaySlots(trip, days, clusters.length);
  const mapped = await attachWeather(clusters, slots);

  return {
    preview: {
      pace,
      requested_day_count: requestedDayCount,
      generated_days: mapped.map(({ slot, weather, cluster }) => ({
        key: slot.key,
        title: cluster.title,
        date: slot.date,
        total_minutes: cluster.total_minutes,
        place_count: cluster.places.length,
        weather,
        places: cluster.places.map(place => ({
          id: place.id,
          name: place.name,
          address: place.address,
          category: place.category,
          lat: place.lat,
          lng: place.lng,
          duration_minutes: place.duration_minutes,
          distance_from_previous_km: place.distance_from_previous_km,
          outdoor_bias: place.outdoor_bias,
        })),
      })),
      leftovers,
    }
  };
}

export async function applyGeneratedItinerary(tripId: number | string, options: PlannerOptions) {
  const { preview } = await generateItineraryPreview(tripId, options);
  const createdDays: number[] = [];
  const updatedDays: number[] = [];
  const createdAssignments: Array<{ dayId: number; assignmentId: number }> = [];
  const skippedPlaces: Array<{ id: number; name: string; reason: string }> = [];

  for (const generatedDay of preview.generated_days) {
    let dayId: number;
    if (generatedDay.key.startsWith('existing-')) {
      dayId = Number(generatedDay.key.replace('existing-', ''));
      const existing = db.prepare('SELECT id, title, date FROM days WHERE id = ?').get(dayId) as { id: number; title: string | null; date: string | null } | undefined;
      if (!existing) continue;
      db.prepare('UPDATE days SET title = ?, date = ? WHERE id = ?').run(
        generatedDay.title,
        existing.date || generatedDay.date,
        dayId
      );
      updatedDays.push(dayId);
    } else {
      const maxDay = db.prepare('SELECT MAX(day_number) as max FROM days WHERE trip_id = ?').get(tripId) as { max: number | null };
      const dayNumber = (maxDay.max || 0) + 1;
      const result = db.prepare('INSERT INTO days (trip_id, day_number, date, title, notes) VALUES (?, ?, ?, ?, NULL)')
        .run(tripId, dayNumber, generatedDay.date, generatedDay.title);
      dayId = Number(result.lastInsertRowid);
      createdDays.push(dayId);
    }

    let orderIndex = 0;
    for (const place of generatedDay.places) {
      const stillUnassigned = db.prepare(`
        SELECT p.id, p.name
        FROM places p
        WHERE p.id = ?
          AND p.trip_id = ?
          AND NOT EXISTS (SELECT 1 FROM day_assignments a WHERE a.place_id = p.id)
      `).get(place.id, tripId) as { id: number; name: string } | undefined;
      if (!stillUnassigned) {
        skippedPlaces.push({ id: place.id, name: place.name, reason: 'Already assigned' });
        continue;
      }
      const result = db.prepare('INSERT INTO day_assignments (day_id, place_id, order_index, notes) VALUES (?, ?, ?, NULL)')
        .run(dayId, place.id, orderIndex++);
      createdAssignments.push({ dayId, assignmentId: Number(result.lastInsertRowid) });
    }
  }

  return {
    preview,
    createdDays,
    updatedDays,
    createdAssignments,
    skippedPlaces,
  };
}

export function getDayForBroadcast(dayId: number) {
  return db.prepare('SELECT * FROM days WHERE id = ?').get(dayId);
}

export function getAssignmentForBroadcast(dayId: number, assignmentId: number) {
  return getAssignmentsForDay(dayId).find(assignment => assignment.id === assignmentId);
}
