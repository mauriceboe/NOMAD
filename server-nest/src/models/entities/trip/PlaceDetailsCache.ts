import { Column, Entity, PrimaryColumn } from 'typeorm';
import { TimestampedEntity } from '../base/BaseEntity';

@Entity('place_details_cache')
export class PlaceDetailsCache extends TimestampedEntity {
  @PrimaryColumn({ name: 'place_id' })
  placeId: string;

  @PrimaryColumn({ name: 'lang', default: '' })
  lang: string;

  @PrimaryColumn('int', { name: 'expanded', default: 0 })
  expanded: number;

  @Column('simple-json', { name: 'payload_json' })
  payloadJson: Record<string, unknown>;

  @Column('int', { name: 'fetched_at' })
  fetchedAt: number;
}
