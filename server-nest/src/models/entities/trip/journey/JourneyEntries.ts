import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { Places } from '../Places';
import { Trips } from '../Trips';
import { Journeys } from './Journeys';
import { JourneyEntryPhotos } from './JourneyEntryPhotos';
import { IntSortableBaseEntity } from '../../base/BaseEntity';
import { SqliteUsers } from '../../old-entities/SqliteUsers';

@Index('idx_journey_entries_order', ['journeyId', 'entryDate', 'sortOrder'], {})
@Index('idx_journey_entries_source', ['sourcePlaceId'], {})
@Index('idx_journey_entries_journey', ['journeyId', 'entryDate'], {})
@Entity('journey_entries')
export class JourneyEntries extends IntSortableBaseEntity {
  @Column('int', { name: 'journey_id' })
  journeyId: number;

  @Column('int', { name: 'source_place_id', nullable: true })
  sourcePlaceId: number | null;

  @Column({ name: 'type' })
  type: string;

  @Column({ name: 'title', nullable: true })
  title: string | null;

  @Column('text', { name: 'story', nullable: true })
  story: string | null;

  @Column({ name: 'entry_date' })
  entryDate: string;

  @Column({ name: 'entry_time', nullable: true })
  entryTime: string | null;

  @Column({ name: 'location_name', nullable: true })
  locationName: string | null;

  @Column({ name: 'location_lat', nullable: true })
  locationLat: number | null;

  @Column({ name: 'location_lng', nullable: true })
  locationLng: number | null;

  @Column({ name: 'mood', nullable: true })
  mood: string | null;

  @Column({ name: 'weather', nullable: true })
  weather: string | null;

  @Column({ name: 'tags', nullable: true })
  tags: string | null;

  @Column({
    name: 'visibility',
    nullable: true,
    default: 'private',
  })
  visibility: string | null;

  @Column('text', { name: 'pros_cons', nullable: true })
  prosCons: string | null;

  @ManyToOne(() => SqliteUsers, (users) => users.journeyEntries)
  @JoinColumn([{ name: 'author_id', referencedColumnName: 'id' }])
  author: SqliteUsers;

  @ManyToOne(() => Places, (places) => places.journeyEntries, {
    onDelete: 'SET NULL',
  })
  @JoinColumn([{ name: 'source_place_id', referencedColumnName: 'id' }])
  sourcePlace: Places;

  @ManyToOne(() => Trips, (trips) => trips.journeyEntries, {
    onDelete: 'SET NULL',
  })
  @JoinColumn([{ name: 'source_trip_id', referencedColumnName: 'id' }])
  sourceTrip: Trips;

  @ManyToOne(() => Journeys, (journeys) => journeys.journeyEntries, {
    onDelete: 'CASCADE',
  })
  @JoinColumn([{ name: 'journey_id', referencedColumnName: 'id' }])
  journey: Journeys;

  @OneToMany(
    () => JourneyEntryPhotos,
    (journeyEntryPhotos) => journeyEntryPhotos.entry,
  )
  journeyEntryPhotos: JourneyEntryPhotos[];
}
