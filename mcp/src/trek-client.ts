export interface TrekTrip {
  id: number;
  title: string;
  description?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  currency: string;
  day_count?: number;
  place_count?: number;
  is_archived?: number;
  owner_username?: string;
}

export interface TrekPlace {
  id: number;
  name: string;
  description?: string | null;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  place_time?: string | null;
  end_time?: string | null;
  duration_minutes?: number | null;
  notes?: string | null;
  image_url?: string | null;
  website?: string | null;
  phone?: string | null;
  transport_mode?: string | null;
  category?: {
    id: number;
    name: string;
    color?: string | null;
    icon?: string | null;
  } | null;
  tags?: Array<{ id: number; name: string; color?: string | null }>;
}

export interface TrekAssignment {
  id: number;
  day_id: number;
  order_index: number;
  notes?: string | null;
  place: TrekPlace;
}

export interface TrekDayNote {
  id: number;
  day_id: number;
  trip_id: number;
  text: string;
  time?: string | null;
  icon?: string | null;
  sort_order: number;
  created_at?: string;
}

export interface TrekDay {
  id: number;
  trip_id: number;
  day_number: number;
  date?: string | null;
  notes?: string | null;
  title?: string | null;
  assignments: TrekAssignment[];
  notes_items: TrekDayNote[];
}

export interface TrekReservation {
  id: number;
  trip_id: number;
  day_id?: number | null;
  place_id?: number | null;
  assignment_id?: number | null;
  title: string;
  reservation_time?: string | null;
  reservation_end_time?: string | null;
  location?: string | null;
  confirmation_number?: string | null;
  notes?: string | null;
  status: string;
  type: string;
  metadata?: string | null;
  day_number?: number | null;
  place_name?: string | null;
  accommodation_name?: string | null;
}

export interface TrekBudgetItemMember {
  user_id: number;
  paid: number;
  username: string;
  avatar_url?: string | null;
}

export interface TrekBudgetItem {
  id: number;
  trip_id: number;
  category: string;
  name: string;
  total_price: number;
  persons?: number | null;
  days?: number | null;
  note?: string | null;
  sort_order: number;
  members?: TrekBudgetItemMember[];
}

interface TrekUser {
  id: number;
  email: string;
  username: string;
}

interface TrekAuthResponse {
  token: string;
  user: TrekUser;
}

export interface CreateDayNoteInput {
  text: string;
  time?: string;
  icon?: string;
  sort_order?: number;
}

export interface CreatePlaceInput {
  name: string;
  description?: string;
  address?: string;
  lat?: number;
  lng?: number;
  place_time?: string;
  end_time?: string;
  duration_minutes?: number;
  notes?: string;
  website?: string;
  phone?: string;
  transport_mode?: string;
}

export interface CreateReservationInput {
  title: string;
  reservation_time?: string;
  reservation_end_time?: string;
  location?: string;
  confirmation_number?: string;
  notes?: string;
  day_id?: number;
  place_id?: number;
  status?: string;
  type?: string;
  metadata?: Record<string, string>;
}

export interface CreateBudgetItemInput {
  category?: string;
  name: string;
  total_price?: number;
  persons?: number;
  days?: number;
  note?: string;
}

interface TrekClientOptions {
  baseUrl: string;
  email: string;
  password: string;
}

function normalizeBaseUrl(input: string): string {
  const trimmed = input.trim().replace(/\/+$/, '');
  return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

export class TrekClient {
  private readonly baseUrl: string;
  private readonly email: string;
  private readonly password: string;
  private token: string | null = null;

  constructor(options: TrekClientOptions) {
    this.baseUrl = normalizeBaseUrl(options.baseUrl);
    this.email = options.email;
    this.password = options.password;
  }

  private async login(force = false): Promise<string> {
    if (!force && this.token) return this.token;

    const response = await fetch(`${this.baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: this.email, password: this.password }),
    });

    if (!response.ok) {
      throw new Error(`TREK login failed (${response.status}): ${await this.parseError(response)}`);
    }

    const payload = await response.json() as TrekAuthResponse;
    this.token = payload.token;
    return payload.token;
  }

  private async parseError(response: Response): Promise<string> {
    try {
      const payload = await response.json() as { error?: string };
      return payload.error || response.statusText;
    } catch {
      return response.statusText;
    }
  }

  private async request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
    const token = await this.login();
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${token}`);
    if (init.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers,
    });

    if (response.status === 401 && retry) {
      await this.login(true);
      return this.request<T>(path, init, false);
    }

    if (!response.ok) {
      throw new Error(`TREK request failed (${response.status}) ${path}: ${await this.parseError(response)}`);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return await response.json() as T;
  }

  async listTrips(): Promise<TrekTrip[]> {
    const payload = await this.request<{ trips: TrekTrip[] }>('/trips');
    return payload.trips;
  }

  async getTrip(tripId: number): Promise<TrekTrip> {
    const payload = await this.request<{ trip: TrekTrip }>(`/trips/${tripId}`);
    return payload.trip;
  }

  async getDays(tripId: number): Promise<TrekDay[]> {
    const payload = await this.request<{ days: TrekDay[] }>(`/trips/${tripId}/days`);
    return payload.days;
  }

  async listPlaces(tripId: number, search?: string): Promise<TrekPlace[]> {
    const query = search ? `?search=${encodeURIComponent(search)}` : '';
    const payload = await this.request<{ places: TrekPlace[] }>(`/trips/${tripId}/places${query}`);
    return payload.places;
  }

  async listReservations(tripId: number): Promise<TrekReservation[]> {
    const payload = await this.request<{ reservations: TrekReservation[] }>(`/trips/${tripId}/reservations`);
    return payload.reservations;
  }

  async listBudgetItems(tripId: number): Promise<TrekBudgetItem[]> {
    const payload = await this.request<{ items: TrekBudgetItem[] }>(`/trips/${tripId}/budget`);
    return payload.items;
  }

  async createDayNote(tripId: number, dayId: number, input: CreateDayNoteInput): Promise<TrekDayNote> {
    const payload = await this.request<{ note: TrekDayNote }>(`/trips/${tripId}/days/${dayId}/notes`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return payload.note;
  }

  async createPlace(tripId: number, input: CreatePlaceInput): Promise<TrekPlace> {
    const payload = await this.request<{ place: TrekPlace }>(`/trips/${tripId}/places`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return payload.place;
  }

  async createReservation(tripId: number, input: CreateReservationInput): Promise<TrekReservation> {
    const payload = await this.request<{ reservation: TrekReservation }>(`/trips/${tripId}/reservations`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return payload.reservation;
  }

  async createBudgetItem(tripId: number, input: CreateBudgetItemInput): Promise<TrekBudgetItem> {
    const payload = await this.request<{ item: TrekBudgetItem }>(`/trips/${tripId}/budget`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return payload.item;
  }
}

function normalizeText(value: string | null | undefined): string {
  return (value || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

export async function resolveTrip(client: TrekClient, tripId?: number, tripTitle?: string): Promise<TrekTrip> {
  if (tripId) return client.getTrip(tripId);

  const trips = await client.listTrips();
  if (trips.length === 0) {
    throw new Error('No trips available in TREK.');
  }

  if (!tripTitle) {
    if (trips.length === 1) return trips[0];
    throw new Error(`Multiple trips found. Provide tripId or tripTitle. Available: ${trips.map(trip => `${trip.id}:${trip.title}`).join(', ')}`);
  }

  const query = normalizeText(tripTitle);
  const exact = trips.find(trip => normalizeText(trip.title) === query);
  if (exact) return exact;

  const partialMatches = trips.filter(trip => normalizeText(trip.title).includes(query));
  if (partialMatches.length === 1) return partialMatches[0];
  if (partialMatches.length > 1) {
    throw new Error(`Multiple trips match "${tripTitle}". Matches: ${partialMatches.map(trip => `${trip.id}:${trip.title}`).join(', ')}`);
  }

  throw new Error(`Trip "${tripTitle}" not found.`);
}

export async function resolveDay(
  client: TrekClient,
  tripId: number,
  options: { dayNumber?: number; date?: string }
): Promise<TrekDay> {
  const days = await client.getDays(tripId);

  if (options.dayNumber !== undefined) {
    const byNumber = days.find(day => day.day_number === options.dayNumber);
    if (!byNumber) throw new Error(`Day ${options.dayNumber} not found in trip ${tripId}.`);
    return byNumber;
  }

  if (options.date) {
    const byDate = days.find(day => day.date === options.date);
    if (!byDate) throw new Error(`No day found for date ${options.date} in trip ${tripId}.`);
    return byDate;
  }

  throw new Error('Provide dayNumber or date to resolve the day.');
}

export function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'EUR',
    maximumFractionDigits: 2,
  }).format(amount || 0);
}

export function formatError(error: unknown): string {
  return errorMessage(error);
}
