import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { TripPhotos } from '../TripPhotos';
import { JourneyPhotos } from './JourneyPhotos';
import { IntBaseEntity } from '../../base/BaseEntity';
import { SqliteUsers } from '../../old-entities/SqliteUsers';

@Index('idx_trek_photos_owner', ['ownerId'], {})
@Index('idx_trek_photos_provider_asset', ['provider', 'assetId', 'ownerId'], {
  unique: true,
})
@Entity('trek_photos')
export class TrekPhotos extends IntBaseEntity {
  @Column({ name: 'provider' })
  provider: string;

  @Column({ name: 'asset_id', nullable: true })
  assetId: string | null;

  @Column('int', { name: 'owner_id', nullable: true })
  ownerId: number | null;

  @Column({ name: 'file_path', nullable: true })
  filePath: string | null;

  @Column({ name: 'thumbnail_path', nullable: true })
  thumbnailPath: string | null;

  @Column('int', { name: 'width', nullable: true })
  width: number | null;

  @Column('int', { name: 'height', nullable: true })
  height: number | null;

  @Column({ name: 'passphrase', nullable: true, default: null })
  passphrase: string | null;

  @ManyToOne(() => SqliteUsers, (users) => users.trekPhotos, {
    onDelete: 'SET NULL',
  })
  @JoinColumn([{ name: 'owner_id', referencedColumnName: 'id' }])
  owner: SqliteUsers;

  @OneToMany(() => TripPhotos, (tripPhotos) => tripPhotos.photo)
  tripPhotos: TripPhotos[];

  @OneToMany(() => JourneyPhotos, (journeyPhotos) => journeyPhotos.photo)
  journeyPhotos: JourneyPhotos[];
}
