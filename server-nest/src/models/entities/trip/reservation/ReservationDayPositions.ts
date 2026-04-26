import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Reservations } from './Reservations';
import { TimestampedEntity } from '../../base/BaseEntity';
import { Days } from '../Days';

@Entity('reservation_day_positions')
export class ReservationDayPositions extends TimestampedEntity {
  @PrimaryColumn('int', { name: 'reservation_id' })
  reservationId: number;

  @PrimaryColumn('int', { name: 'day_id' })
  dayId: number;

  @Column({ name: 'position' })
  position: number;

  @ManyToOne(() => Days, (days) => days.reservationDayPositions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn([{ name: 'day_id', referencedColumnName: 'id' }])
  day: Days;

  @ManyToOne(
    () => Reservations,
    (reservations) => reservations.reservationDayPositions,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn([{ name: 'reservation_id', referencedColumnName: 'id' }])
  reservation: Reservations;
}
