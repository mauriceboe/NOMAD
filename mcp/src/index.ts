import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { NextFunction, Request, Response } from 'express';
import * as z from 'zod/v4';
import {
  formatError,
  formatMoney,
  resolveDay,
  resolveTrip,
  TrekBudgetItem,
  TrekClient,
  TrekDay,
  TrekPlace,
  TrekReservation,
  TrekTrip,
} from './trek-client.js';

const config = {
  trekBaseUrl: process.env.TREK_BASE_URL || 'http://localhost:3001/api',
  trekEmail: process.env.TREK_EMAIL,
  trekPassword: process.env.TREK_PASSWORD,
  port: Number(process.env.MCP_PORT || process.env.PORT || 3333),
  path: process.env.MCP_PATH || '/mcp',
  host: process.env.MCP_HOST || '0.0.0.0',
  authToken: process.env.MCP_AUTH_TOKEN?.trim() || '',
  allowedHosts: (process.env.MCP_ALLOWED_HOSTS || '')
    .split(',')
    .map(host => host.trim())
    .filter(Boolean),
};

if (!config.trekEmail || !config.trekPassword) {
  throw new Error('TREK_EMAIL and TREK_PASSWORD are required.');
}

const trekClient = new TrekClient({
  baseUrl: config.trekBaseUrl,
  email: config.trekEmail,
  password: config.trekPassword,
});

type TripLookup = {
  tripId?: number;
  tripTitle?: string;
};

function normalizeSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

function formatTripWindow(trip: TrekTrip): string {
  if (trip.start_date && trip.end_date) return `${trip.start_date} -> ${trip.end_date}`;
  if (trip.start_date) return `starts ${trip.start_date}`;
  return 'no dates set';
}

function summarizeReservation(reservation: TrekReservation): string {
  const when = reservation.reservation_time || 'no time';
  const where = reservation.location || reservation.place_name || reservation.accommodation_name || 'no location';
  return `- ${reservation.title} | ${reservation.type} | ${reservation.status} | ${when} | ${where}`;
}

function summarizeBudgetItem(item: TrekBudgetItem, currency: string): string {
  return `- ${item.category}: ${item.name} (${formatMoney(Number(item.total_price || 0), currency)})`;
}

function summarizePlace(place: TrekPlace): string {
  const category = place.category?.name || 'Uncategorized';
  const timing = [place.place_time, place.end_time].filter(Boolean).join(' -> ') || 'no time';
  const address = place.address || 'no address';
  return `- ${place.name} | ${category} | ${timing} | ${address}`;
}

function summarizeDay(day: TrekDay): string {
  const label = day.title ? ` - ${day.title}` : '';
  const lines = [`Day ${day.day_number}${label}${day.date ? ` (${day.date})` : ''}`];

  if (day.assignments.length > 0) {
    lines.push('Assignments:');
    for (const assignment of day.assignments) {
      const timing = [assignment.place.place_time, assignment.place.end_time].filter(Boolean).join(' -> ') || 'no time';
      lines.push(`- ${assignment.place.name} | ${timing}`);
    }
  }

  if (day.notes_items.length > 0) {
    lines.push('Notes:');
    for (const note of day.notes_items) {
      lines.push(`- ${note.time || 'no time'} | ${note.text}`);
    }
  }

  if (day.notes) {
    lines.push(`Day notes: ${day.notes}`);
  }

  return lines.join('\n');
}

function buildServer(): McpServer {
  const server = new McpServer(
    {
      name: 'trek-mcp',
      version: '0.1.0',
    },
    {
      capabilities: {
        logging: {},
      },
    }
  );

  server.registerTool(
    'list_trips',
    {
      title: 'List Trips',
      description: 'List the trips accessible to the configured TREK account.',
    },
    async () => {
      try {
        const trips = await trekClient.listTrips();
        const text = trips.length === 0
          ? 'No trips found.'
          : trips.map(trip => `- ${trip.id}: ${trip.title} | ${formatTripWindow(trip)} | ${trip.currency}`).join('\n');

        return {
          content: [{ type: 'text', text }],
          structuredContent: { trips },
        };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: 'text', text: formatError(error) }],
        };
      }
    }
  );

  server.registerTool(
    'get_trip_summary',
    {
      title: 'Get Trip Summary',
      description: 'Return a compact overview of one trip with counts, reservations, budget, and notes.',
      inputSchema: {
        tripId: z.number().int().positive().optional(),
        tripTitle: z.string().min(1).optional(),
      },
    },
    async (input: TripLookup) => {
      try {
        const trip = await resolveTrip(trekClient, input.tripId, input.tripTitle);
        const [days, places, reservations, budgetItems] = await Promise.all([
          trekClient.getDays(trip.id),
          trekClient.listPlaces(trip.id),
          trekClient.listReservations(trip.id),
          trekClient.listBudgetItems(trip.id),
        ]);

        const noteCount = days.reduce((sum, day) => sum + day.notes_items.length, 0);
        const budgetTotal = budgetItems.reduce((sum, item) => sum + Number(item.total_price || 0), 0);
        const upcomingReservations = [...reservations]
          .sort((a, b) => (a.reservation_time || '').localeCompare(b.reservation_time || ''))
          .slice(0, 5);
        const dayPreview = days.slice(0, 5).map(day => ({
          id: day.id,
          dayNumber: day.day_number,
          date: day.date,
          title: day.title,
          assignments: day.assignments.length,
          notes: day.notes_items.length,
        }));

        const text = [
          `${trip.title} (${trip.id})`,
          `Window: ${formatTripWindow(trip)}`,
          `Currency: ${trip.currency}`,
          `Days: ${days.length}`,
          `Places: ${places.length}`,
          `Reservations: ${reservations.length}`,
          `Budget total: ${formatMoney(budgetTotal, trip.currency)}`,
          `Day notes: ${noteCount}`,
          upcomingReservations.length > 0 ? 'Upcoming reservations:' : 'Upcoming reservations: none',
          ...upcomingReservations.map(summarizeReservation),
        ].join('\n');

        return {
          content: [{ type: 'text', text }],
          structuredContent: {
            trip,
            counts: {
              days: days.length,
              places: places.length,
              reservations: reservations.length,
              budgetItems: budgetItems.length,
              dayNotes: noteCount,
            },
            budgetTotal,
            dayPreview,
            upcomingReservations,
          },
        };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: 'text', text: formatError(error) }],
        };
      }
    }
  );

  server.registerTool(
    'get_day_plan',
    {
      title: 'Get Day Plan',
      description: 'Return the plan, places, and notes for a specific day in a trip.',
      inputSchema: {
        tripId: z.number().int().positive().optional(),
        tripTitle: z.string().min(1).optional(),
        dayNumber: z.number().int().positive().optional(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      },
    },
    async (input: TripLookup & { dayNumber?: number; date?: string }) => {
      try {
        const trip = await resolveTrip(trekClient, input.tripId, input.tripTitle);
        const day = await resolveDay(trekClient, trip.id, {
          dayNumber: input.dayNumber,
          date: input.date,
        });

        return {
          content: [{ type: 'text', text: summarizeDay(day) }],
          structuredContent: { trip, day },
        };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: 'text', text: formatError(error) }],
        };
      }
    }
  );

  server.registerTool(
    'search_trip_notes',
    {
      title: 'Search Trip Notes',
      description: 'Search free-text notes across day notes and per-day notes in a trip.',
      inputSchema: {
        tripId: z.number().int().positive().optional(),
        tripTitle: z.string().min(1).optional(),
        query: z.string().min(1),
      },
    },
    async (input: TripLookup & { query: string }) => {
      try {
        const trip = await resolveTrip(trekClient, input.tripId, input.tripTitle);
        const days = await trekClient.getDays(trip.id);
        const query = normalizeSearch(input.query);
        const matches: Array<Record<string, unknown>> = [];

        for (const day of days) {
          if (day.notes && normalizeSearch(day.notes).includes(query)) {
            matches.push({
              kind: 'day_notes',
              dayId: day.id,
              dayNumber: day.day_number,
              date: day.date,
              title: day.title,
              text: day.notes,
            });
          }

          for (const note of day.notes_items) {
            const haystack = [note.text, note.time, note.icon].filter(Boolean).join(' ');
            if (normalizeSearch(haystack).includes(query)) {
              matches.push({
                kind: 'day_note_item',
                noteId: note.id,
                dayId: day.id,
                dayNumber: day.day_number,
                date: day.date,
                time: note.time,
                icon: note.icon,
                text: note.text,
              });
            }
          }
        }

        const text = matches.length === 0
          ? `No note matches found for "${input.query}".`
          : matches
              .slice(0, 25)
              .map(match => `- Day ${match.dayNumber}${match.date ? ` (${match.date})` : ''} | ${match.kind} | ${match.time || 'no time'} | ${match.text}`)
              .join('\n');

        return {
          content: [{ type: 'text', text }],
          structuredContent: {
            trip,
            query: input.query,
            matches,
          },
        };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: 'text', text: formatError(error) }],
        };
      }
    }
  );

  server.registerTool(
    'list_trip_places',
    {
      title: 'List Trip Places',
      description: 'List saved places for a trip, optionally filtered by search text.',
      inputSchema: {
        tripId: z.number().int().positive().optional(),
        tripTitle: z.string().min(1).optional(),
        search: z.string().min(1).optional(),
      },
    },
    async (input: TripLookup & { search?: string }) => {
      try {
        const trip = await resolveTrip(trekClient, input.tripId, input.tripTitle);
        const places = await trekClient.listPlaces(trip.id, input.search);

        return {
          content: [{ type: 'text', text: places.length ? places.map(summarizePlace).join('\n') : 'No places found.' }],
          structuredContent: { trip, places },
        };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: 'text', text: formatError(error) }],
        };
      }
    }
  );

  server.registerTool(
    'list_reservations',
    {
      title: 'List Reservations',
      description: 'List reservations for a trip, optionally filtered by status or type.',
      inputSchema: {
        tripId: z.number().int().positive().optional(),
        tripTitle: z.string().min(1).optional(),
        status: z.string().min(1).optional(),
        type: z.string().min(1).optional(),
      },
    },
    async (input: TripLookup & { status?: string; type?: string }) => {
      try {
        const trip = await resolveTrip(trekClient, input.tripId, input.tripTitle);
        const reservations = (await trekClient.listReservations(trip.id)).filter(reservation => {
          if (input.status && reservation.status !== input.status) return false;
          if (input.type && reservation.type !== input.type) return false;
          return true;
        });

        return {
          content: [{ type: 'text', text: reservations.length ? reservations.map(summarizeReservation).join('\n') : 'No reservations found.' }],
          structuredContent: { trip, reservations },
        };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: 'text', text: formatError(error) }],
        };
      }
    }
  );

  server.registerTool(
    'list_budget_items',
    {
      title: 'List Budget Items',
      description: 'List budget items for a trip, optionally filtered by category.',
      inputSchema: {
        tripId: z.number().int().positive().optional(),
        tripTitle: z.string().min(1).optional(),
        category: z.string().min(1).optional(),
      },
    },
    async (input: TripLookup & { category?: string }) => {
      try {
        const trip = await resolveTrip(trekClient, input.tripId, input.tripTitle);
        const items = (await trekClient.listBudgetItems(trip.id)).filter(item => {
          if (!input.category) return true;
          return normalizeSearch(item.category) === normalizeSearch(input.category);
        });
        const total = items.reduce((sum, item) => sum + Number(item.total_price || 0), 0);

        return {
          content: [{ type: 'text', text: items.length ? `${items.map(item => summarizeBudgetItem(item, trip.currency)).join('\n')}\nTotal: ${formatMoney(total, trip.currency)}` : 'No budget items found.' }],
          structuredContent: { trip, items, total },
        };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: 'text', text: formatError(error) }],
        };
      }
    }
  );

  server.registerTool(
    'add_day_note',
    {
      title: 'Add Day Note',
      description: 'Create a new note entry inside a specific trip day.',
      inputSchema: {
        tripId: z.number().int().positive().optional(),
        tripTitle: z.string().min(1).optional(),
        dayNumber: z.number().int().positive().optional(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        text: z.string().min(1).max(500),
        time: z.string().max(150).optional(),
        icon: z.string().max(8).optional(),
      },
    },
    async (input: TripLookup & { dayNumber?: number; date?: string; text: string; time?: string; icon?: string }) => {
      try {
        const trip = await resolveTrip(trekClient, input.tripId, input.tripTitle);
        const day = await resolveDay(trekClient, trip.id, { dayNumber: input.dayNumber, date: input.date });
        const note = await trekClient.createDayNote(trip.id, day.id, {
          text: input.text,
          time: input.time,
          icon: input.icon,
        });

        return {
          content: [{ type: 'text', text: `Created note in ${trip.title}, day ${day.day_number}: ${note.text}` }],
          structuredContent: { trip, day, note },
        };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: 'text', text: formatError(error) }],
        };
      }
    }
  );

  server.registerTool(
    'add_place',
    {
      title: 'Add Place',
      description: 'Create a new place in a trip.',
      inputSchema: {
        tripId: z.number().int().positive().optional(),
        tripTitle: z.string().min(1).optional(),
        name: z.string().min(1).max(200),
        description: z.string().max(2000).optional(),
        address: z.string().max(500).optional(),
        lat: z.number().optional(),
        lng: z.number().optional(),
        placeTime: z.string().optional(),
        endTime: z.string().optional(),
        durationMinutes: z.number().int().positive().optional(),
        notes: z.string().max(2000).optional(),
        website: z.string().url().optional(),
        phone: z.string().optional(),
        transportMode: z.enum(['walking', 'driving', 'transit', 'bicycling']).optional(),
      },
    },
    async (
      input: TripLookup & {
        name: string;
        description?: string;
        address?: string;
        lat?: number;
        lng?: number;
        placeTime?: string;
        endTime?: string;
        durationMinutes?: number;
        notes?: string;
        website?: string;
        phone?: string;
        transportMode?: 'walking' | 'driving' | 'transit' | 'bicycling';
      }
    ) => {
      try {
        const trip = await resolveTrip(trekClient, input.tripId, input.tripTitle);
        const place = await trekClient.createPlace(trip.id, {
          name: input.name,
          description: input.description,
          address: input.address,
          lat: input.lat,
          lng: input.lng,
          place_time: input.placeTime,
          end_time: input.endTime,
          duration_minutes: input.durationMinutes,
          notes: input.notes,
          website: input.website,
          phone: input.phone,
          transport_mode: input.transportMode,
        });

        return {
          content: [{ type: 'text', text: `Created place "${place.name}" in ${trip.title}.` }],
          structuredContent: { trip, place },
        };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: 'text', text: formatError(error) }],
        };
      }
    }
  );

  server.registerTool(
    'create_reservation',
    {
      title: 'Create Reservation',
      description: 'Create a reservation for a trip.',
      inputSchema: {
        tripId: z.number().int().positive().optional(),
        tripTitle: z.string().min(1).optional(),
        title: z.string().min(1),
        reservationTime: z.string().optional(),
        reservationEndTime: z.string().optional(),
        location: z.string().optional(),
        confirmationNumber: z.string().optional(),
        notes: z.string().optional(),
        dayNumber: z.number().int().positive().optional(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        placeId: z.number().int().positive().optional(),
        status: z.string().optional(),
        type: z.string().optional(),
        metadata: z.record(z.string(), z.string()).optional(),
      },
    },
    async (
      input: TripLookup & {
        title: string;
        reservationTime?: string;
        reservationEndTime?: string;
        location?: string;
        confirmationNumber?: string;
        notes?: string;
        dayNumber?: number;
        date?: string;
        placeId?: number;
        status?: string;
        type?: string;
        metadata?: Record<string, string>;
      }
    ) => {
      try {
        const trip = await resolveTrip(trekClient, input.tripId, input.tripTitle);
        const day = input.dayNumber !== undefined || input.date
          ? await resolveDay(trekClient, trip.id, { dayNumber: input.dayNumber, date: input.date })
          : undefined;

        const reservation = await trekClient.createReservation(trip.id, {
          title: input.title,
          reservation_time: input.reservationTime,
          reservation_end_time: input.reservationEndTime,
          location: input.location,
          confirmation_number: input.confirmationNumber,
          notes: input.notes,
          day_id: day?.id,
          place_id: input.placeId,
          status: input.status,
          type: input.type,
          metadata: input.metadata,
        });

        return {
          content: [{ type: 'text', text: `Created reservation "${reservation.title}" in ${trip.title}.` }],
          structuredContent: { trip, day, reservation },
        };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: 'text', text: formatError(error) }],
        };
      }
    }
  );

  server.registerTool(
    'create_budget_item',
    {
      title: 'Create Budget Item',
      description: 'Create a new budget item for a trip.',
      inputSchema: {
        tripId: z.number().int().positive().optional(),
        tripTitle: z.string().min(1).optional(),
        category: z.string().optional(),
        name: z.string().min(1),
        totalPrice: z.number().optional(),
        persons: z.number().int().positive().optional(),
        days: z.number().int().positive().optional(),
        note: z.string().optional(),
      },
    },
    async (
      input: TripLookup & {
        category?: string;
        name: string;
        totalPrice?: number;
        persons?: number;
        days?: number;
        note?: string;
      }
    ) => {
      try {
        const trip = await resolveTrip(trekClient, input.tripId, input.tripTitle);
        const item = await trekClient.createBudgetItem(trip.id, {
          category: input.category,
          name: input.name,
          total_price: input.totalPrice,
          persons: input.persons,
          days: input.days,
          note: input.note,
        });

        return {
          content: [{ type: 'text', text: `Created budget item "${item.name}" in ${trip.title}.` }],
          structuredContent: { trip, item },
        };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: 'text', text: formatError(error) }],
        };
      }
    }
  );

  return server;
}

const app = createMcpExpressApp({
  host: config.host,
  allowedHosts: config.allowedHosts.length > 0 ? config.allowedHosts : undefined,
});

app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'trek-mcp',
    trekBaseUrl: config.trekBaseUrl,
    authProtected: Boolean(config.authToken),
  });
});

app.get('/', (_req: Request, res: Response) => {
  res.json({
    service: 'trek-mcp',
    mcpPath: config.path,
  });
});

app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.path !== config.path || !config.authToken) return next();

  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (token !== config.authToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
});

app.post(config.path, async (req: Request, res: Response) => {
  const server = buildServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  try {
    await server.connect(transport);
    res.on('close', async () => {
      await transport.close();
      await server.close();
    });
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error('Error handling MCP request:', error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: formatError(error),
        },
        id: null,
      });
    }
  }
});

app.get(config.path, (_req: Request, res: Response) => {
  res.status(405).json({
    error: 'Use POST for Streamable HTTP MCP requests.',
  });
});

app.delete(config.path, (_req: Request, res: Response) => {
  res.status(405).json({
    error: 'DELETE is not supported by this server.',
  });
});

app.listen(config.port, config.host, () => {
  console.log(`TREK MCP listening on ${config.host}:${config.port}${config.path}`);
});
