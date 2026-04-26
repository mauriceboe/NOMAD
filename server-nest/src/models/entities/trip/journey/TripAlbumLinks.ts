import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { Trips } from '../Trips';
import { TripPhotos } from '../TripPhotos';
import { IntBaseEntity } from '../../base/BaseEntity';
import { SqliteUsers } from '../../old-entities/SqliteUsers';

@Index('idx_trip_album_links_trip', ['tripId'], {})
@Entity('trip_album_links')
export class TripAlbumLinks extends IntBaseEntity {
  @Column('int', { name: 'trip_id' })
  tripId: number;

  @Column({ name: 'provider' })
  provider: string;

  @Column({ name: 'album_id' })
  albumId: string;

  @Column({ name: 'album_name', default: '' })
  albumName: string;

  @Column({ name: 'sync_enabled', default: true })
  syncEnabled: boolean;

  @Column('datetime', { name: 'last_synced_at', nullable: true })
  lastSyncedAt: Date | null;

  @Column({ name: 'passphrase', nullable: true, default: null })
  passphrase: string | null;

  @ManyToOne(() => SqliteUsers, (users) => users.tripAlbumLinks, {
    onDelete: 'CASCADE',
  })
  @JoinColumn([{ name: 'user_id', referencedColumnName: 'id' }])
  user: SqliteUsers;

  @ManyToOne(() => Trips, (trips) => trips.tripAlbumLinks, {
    onDelete: 'CASCADE',
  })
  @JoinColumn([{ name: 'trip_id', referencedColumnName: 'id' }])
  trip: Trips;

  @OneToMany(() => TripPhotos, (tripPhotos) => tripPhotos.albumLink)
  tripPhotos: TripPhotos[];
}
