import { z } from 'zod';

const RESERVATION_TYPES = ['flight', 'hotel', 'restaurant', 'train', 'car', 'cruise', 'event', 'tour', 'activity', 'other'] as const;

export const CreateReservationSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  type: z.enum(RESERVATION_TYPES).optional(),
  reservation_time: z.string().max(50).optional().nullable(),
  reservation_end_time: z.string().max(50).optional().nullable(),
  location: z.string().max(500).optional().nullable(),
  confirmation_number: z.string().max(100).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  day_id: z.number().int().optional().nullable(),
  place_id: z.number().int().optional().nullable(),
  assignment_id: z.number().int().optional().nullable(),
  accommodation_id: z.number().int().optional().nullable(),
  status: z.string().max(50).optional(),
  metadata: z.string().optional().nullable(),
  create_accommodation: z.object({
    place_id: z.number().int(),
    start_day_id: z.number().int(),
    end_day_id: z.number().int(),
    check_in: z.string().max(50).optional().nullable(),
    check_out: z.string().max(50).optional().nullable(),
    confirmation: z.string().max(100).optional().nullable(),
  }).optional(),
});

export const UpdateReservationSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  type: z.enum(RESERVATION_TYPES).optional(),
  reservation_time: z.string().max(50).optional().nullable(),
  reservation_end_time: z.string().max(50).optional().nullable(),
  location: z.string().max(500).optional().nullable(),
  confirmation_number: z.string().max(100).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  day_id: z.number().int().optional().nullable(),
  place_id: z.number().int().optional().nullable(),
  assignment_id: z.number().int().optional().nullable(),
  accommodation_id: z.number().int().optional().nullable(),
  status: z.string().max(50).optional(),
  metadata: z.string().optional().nullable(),
  create_accommodation: z.boolean().optional(),
});

export const ReservationPositionsSchema = z.object({
  positions: z.array(z.object({
    id: z.number().int(),
  }).passthrough()),
});
