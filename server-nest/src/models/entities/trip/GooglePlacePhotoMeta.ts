import { Column, Entity, PrimaryColumn } from 'typeorm';
import { TimestampedEntity } from '../base/BaseEntity';

@Entity('google_place_photo_meta')
export class GooglePlacePhotoMeta extends TimestampedEntity {
  @PrimaryColumn({ name: 'place_id' })
  placeId: string;

  @Column({ name: 'attribution', nullable: true })
  attribution: string | null;

  @Column('int', { name: 'fetched_at' })
  fetchedAt: number;

  @Column('int', { name: 'error_at', nullable: true })
  errorAt: number | null;
}
