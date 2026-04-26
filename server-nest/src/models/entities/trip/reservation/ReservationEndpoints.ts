import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { Reservations } from './Reservations';
import { IntBaseEntity } from '../../base/BaseEntity';

@Index('idx_reservation_endpoints_reservation_id', ['reservationId'], {})
@Entity('reservation_endpoints')
export class ReservationEndpoints extends IntBaseEntity {
  @Column('int', { name: 'reservation_id' })
  reservationId: number;

  @Column({ name: 'role' })
  role: string;

  @Column('int', { name: 'sequence', default: 0 })
  sequence: number;

  @Column({ name: 'name' })
  name: string;

  @Column({ name: 'code', nullable: true })
  code: string | null;

  @Column({ name: 'lat' })
  lat: number;

  @Column({ name: 'lng' })
  lng: number;

  @Column({ name: 'timezone', nullable: true })
  timezone: string | null;

  @Column('text', { name: 'local_time', nullable: true })
  localTime: string | null;

  @Column('text', { name: 'local_date', nullable: true })
  localDate: string | null;

  @ManyToOne(
    () => Reservations,
    (reservations) => reservations.reservationEndpoints,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn([{ name: 'reservation_id', referencedColumnName: 'id' }])
  reservation: Reservations;
}
