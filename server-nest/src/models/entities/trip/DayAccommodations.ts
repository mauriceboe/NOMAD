import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { Days } from './Days';
import { Places } from './Places';
import { Trips } from './Trips';
import { IntBaseEntity } from '../base/BaseEntity';

@Index('idx_day_accommodations_end_day_id', ['endDayId'], {})
@Index('idx_day_accommodations_start_day_id', ['startDayId'], {})
@Index('idx_day_accommodations_trip_id', ['tripId'], {})
@Entity('day_accommodations')
export class DayAccommodations extends IntBaseEntity {
  @Column('int', { name: 'trip_id' })
  tripId: number;

  @Column('int', { name: 'start_day_id' })
  startDayId: number;

  @Column('int', { name: 'end_day_id' })
  endDayId: number;

  @Column({ name: 'check_in', nullable: true })
  checkIn: string | null;

  @Column({ name: 'check_in_end', nullable: true })
  checkInEnd: string | null;

  @Column({ name: 'check_out', nullable: true })
  checkOut: string | null;

  @Column({ name: 'confirmation', nullable: true })
  confirmation: string | null;

  @Column('text', { name: 'notes', nullable: true })
  notes: string | null;

  @ManyToOne(() => Days, (days) => days.dayAccommodations, {
    onDelete: 'CASCADE',
  })
  @JoinColumn([{ name: 'end_day_id', referencedColumnName: 'id' }])
  endDay: Days;

  @ManyToOne(() => Days, (days) => days.dayAccommodations2, {
    onDelete: 'CASCADE',
  })
  @JoinColumn([{ name: 'start_day_id', referencedColumnName: 'id' }])
  startDay: Days;

  @ManyToOne(() => Places, (places) => places.dayAccommodations, {
    onDelete: 'SET NULL',
  })
  @JoinColumn([{ name: 'place_id', referencedColumnName: 'id' }])
  place: Places;

  @ManyToOne(() => Trips, (trips) => trips.dayAccommodations, {
    onDelete: 'CASCADE',
  })
  @JoinColumn([{ name: 'trip_id', referencedColumnName: 'id' }])
  trip: Trips;
}
