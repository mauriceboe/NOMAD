import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { Trips } from './Trips';
import { DayAssignments } from './DayAssignments';
import { DayNotes } from './DayNotes';
import { DayAccommodations } from './DayAccommodations';
import { IntBaseEntity } from '../base/BaseEntity';
import { Photos } from './journey/Photos';
import { Reservations } from './reservation/Reservations';
import { ReservationDayPositions } from './reservation/ReservationDayPositions';

@Index('idx_days_trip_id', ['tripId'], {})
@Entity('days')
export class Days extends IntBaseEntity {
  @Column('int', { name: 'trip_id' })
  tripId: number;

  @Column('int', { name: 'day_number' })
  dayNumber: number;

  @Column({ name: 'date', nullable: true })
  date: string | null;

  @Column('text', { name: 'notes', nullable: true })
  notes: string | null;

  @Column({ name: 'title', nullable: true })
  title: string | null;

  @ManyToOne(() => Trips, (trips) => trips.days, { onDelete: 'CASCADE' })
  @JoinColumn([{ name: 'trip_id', referencedColumnName: 'id' }])
  trip: Trips;

  @OneToMany(() => DayAssignments, (dayAssignments) => dayAssignments.day)
  dayAssignments: DayAssignments[];

  @OneToMany(() => Photos, (photos) => photos.day)
  photos: Photos[];

  @OneToMany(() => Reservations, (reservations) => reservations.endDay)
  reservations: Reservations[];

  @OneToMany(() => Reservations, (reservations) => reservations.day)
  reservations2: Reservations[];

  @OneToMany(() => DayNotes, (dayNotes) => dayNotes.day)
  dayNotes: DayNotes[];

  @OneToMany(
    () => ReservationDayPositions,
    (reservationDayPositions) => reservationDayPositions.day,
  )
  reservationDayPositions: ReservationDayPositions[];

  @OneToMany(
    () => DayAccommodations,
    (dayAccommodations) => dayAccommodations.endDay,
  )
  dayAccommodations: DayAccommodations[];

  @OneToMany(
    () => DayAccommodations,
    (dayAccommodations) => dayAccommodations.startDay,
  )
  dayAccommodations2: DayAccommodations[];
}
