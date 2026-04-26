import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Index('idx_trek_photo_cache_meta_fetched_at', ['fetchedAt'], {})
@Entity('trek_photo_cache_meta')
export class TrekPhotoCacheMeta {
  @PrimaryColumn({ name: 'cache_key' })
  cacheKey: string;

  @Column({ name: 'content_type', default: 'image/jpeg' })
  contentType: string;

  @Column('int', { name: 'fetched_at' })
  fetchedAt: number;
}
