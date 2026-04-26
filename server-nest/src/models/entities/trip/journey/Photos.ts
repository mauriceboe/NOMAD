import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { Places } from '../Places';
import { Trips } from '../Trips';
import { IntBaseEntity } from '../../base/BaseEntity';
import { Days } from '../Days';

@Index('idx_photos_place_id', ['placeId'], {})
@Index('idx_photos_day_id', ['dayId'], {})
@Index('idx_photos_trip_id', ['tripId'], {})
@Entity('photos')
export class Photos extends IntBaseEntity {
  @Column('int', { name: 'trip_id' })
  tripId: number;

  @Column('int', { name: 'day_id', nullable: true })
  dayId: number | null;

  @Column('int', { name: 'place_id', nullable: true })
  placeId: number | null;

  @Column({ name: 'filename' })
  filename: string;

  @Column({ name: 'original_name' })
  originalName: string;

  @Column('int', { name: 'file_size', nullable: true })
  fileSize: number | null;

  @Column({ name: 'mime_type', nullable: true })
  mimeType: string | null;

  @Column({ name: 'caption', nullable: true })
  caption: string | null;

  @Column({ name: 'taken_at', nullable: true })
  takenAt: string | null;

  @ManyToOne(() => Places, (places) => places.photos, { onDelete: 'SET NULL' })
  @JoinColumn([{ name: 'place_id', referencedColumnName: 'id' }])
  place: Places;

  @ManyToOne(() => Days, (days) => days.photos, { onDelete: 'SET NULL' })
  @JoinColumn([{ name: 'day_id', referencedColumnName: 'id' }])
  day: Days;

  @ManyToOne(() => Trips, (trips) => trips.photos, { onDelete: 'CASCADE' })
  @JoinColumn([{ name: 'trip_id', referencedColumnName: 'id' }])
  trip: Trips;
}
