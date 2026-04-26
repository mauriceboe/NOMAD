import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { TripAlbumLinks } from './journey/TripAlbumLinks';
import { TrekPhotos } from './journey/TrekPhotos';
import { Trips } from './Trips';
import { IntBaseEntity } from '../base/BaseEntity';
import { SqliteUsers } from '../old-entities/SqliteUsers';

@Index('idx_trip_photos_photo', ['photoId'], {})
@Index('idx_trip_photos_trip', ['tripId'], {})
@Entity('trip_photos')
export class TripPhotos extends IntBaseEntity {
  @Column('int', { name: 'trip_id' })
  tripId: number;

  @Column('int', { name: 'photo_id' })
  photoId: number;

  @Column({ name: 'shared', default: true })
  shared: boolean;

  @ManyToOne(
    () => TripAlbumLinks,
    (tripAlbumLinks) => tripAlbumLinks.tripPhotos,
    { onDelete: 'SET NULL' },
  )
  @JoinColumn([{ name: 'album_link_id', referencedColumnName: 'id' }])
  albumLink: TripAlbumLinks;

  @ManyToOne(() => TrekPhotos, (trekPhotos) => trekPhotos.tripPhotos, {
    onDelete: 'CASCADE',
  })
  @JoinColumn([{ name: 'photo_id', referencedColumnName: 'id' }])
  photo: TrekPhotos;

  @ManyToOne(() => SqliteUsers, (users) => users.tripPhotos, {
    onDelete: 'CASCADE',
  })
  @JoinColumn([{ name: 'user_id', referencedColumnName: 'id' }])
  user: SqliteUsers;

  @ManyToOne(() => Trips, (trips) => trips.tripPhotos, { onDelete: 'CASCADE' })
  @JoinColumn([{ name: 'trip_id', referencedColumnName: 'id' }])
  trip: Trips;
}
