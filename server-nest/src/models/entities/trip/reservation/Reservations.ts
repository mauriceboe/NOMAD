import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { TripFiles } from '../files/TripFiles';
import { Places } from '../Places';
import { Trips } from '../Trips';
import { FileLinks } from '../../system/FileLinks';
import { ReservationDayPositions } from './ReservationDayPositions';
import { ReservationEndpoints } from './ReservationEndpoints';
import { IntBaseEntity } from '../../base/BaseEntity';
import { DayAssignments } from '../DayAssignments';
import { Days } from '../Days';
import { BudgetItems } from '../budget/BudgetItems';

@Index('idx_reservations_day_id', ['dayId'], {})
@Index('idx_reservations_trip_id', ['tripId'], {})
@Entity('reservations')
export class Reservations extends IntBaseEntity {
  @Column('int', { name: 'trip_id' })
  tripId: number;

  @Column('int', { name: 'day_id', nullable: true })
  dayId: number | null;

  @Column({ name: 'title' })
  title: string;

  @Column('int', { name: 'accommodation_id', nullable: true })
  accommodationId: number | null;

  @Column({ name: 'reservation_time', nullable: true })
  reservationTime: string | null;

  @Column({ name: 'reservation_end_time', nullable: true })
  reservationEndTime: string | null;

  @Column('text', { name: 'location', nullable: true })
  location: string | null;

  @Column({ name: 'confirmation_number', nullable: true })
  confirmationNumber: string | null;

  @Column('text', { name: 'notes', nullable: true })
  notes: string | null;

  @Column({
    name: 'status',
    nullable: true,
    default: 'pending',
  })
  status: string | null;

  @Column({ name: 'type', nullable: true, default: 'other' })
  type: string | null;

  @Column('text', { name: 'metadata', nullable: true })
  metadata: string | null;

  @Column({
    name: 'day_plan_position',
    nullable: true,
    default: null,
  })
  dayPlanPosition: number | null;

  @Column({ name: 'needs_review', default: false })
  needsReview: boolean;

  @OneToMany(() => TripFiles, (tripFiles) => tripFiles.reservation)
  tripFiles: TripFiles[];

  @ManyToOne(
    () => DayAssignments,
    (dayAssignments) => dayAssignments.reservations,
    { onDelete: 'SET NULL' },
  )
  @JoinColumn([{ name: 'assignment_id', referencedColumnName: 'id' }])
  assignment: DayAssignments;

  @ManyToOne(() => Places, (places) => places.reservations, {
    onDelete: 'SET NULL',
  })
  @JoinColumn([{ name: 'place_id', referencedColumnName: 'id' }])
  place: Places;

  @ManyToOne(() => Days, (days) => days.reservations, { onDelete: 'SET NULL' })
  @JoinColumn([{ name: 'end_day_id', referencedColumnName: 'id' }])
  endDay: Days;

  @ManyToOne(() => Days, (days) => days.reservations2, { onDelete: 'SET NULL' })
  @JoinColumn([{ name: 'day_id', referencedColumnName: 'id' }])
  day: Days;

  @ManyToOne(() => Trips, (trips) => trips.reservations, {
    onDelete: 'CASCADE',
  })
  @JoinColumn([{ name: 'trip_id', referencedColumnName: 'id' }])
  trip: Trips;

  @OneToMany(() => BudgetItems, (budgetItems) => budgetItems.reservation)
  budgetItems: BudgetItems[];

  @OneToMany(() => FileLinks, (fileLinks) => fileLinks.reservation)
  fileLinks: FileLinks[];

  @OneToMany(
    () => ReservationDayPositions,
    (reservationDayPositions) => reservationDayPositions.reservation,
  )
  reservationDayPositions: ReservationDayPositions[];

  @OneToMany(
    () => ReservationEndpoints,
    (reservationEndpoints) => reservationEndpoints.reservation,
  )
  reservationEndpoints: ReservationEndpoints[];
}
