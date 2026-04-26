import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToMany,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { Categories } from './Categories';
import { Trips } from './Trips';
import { Tags } from './Tags';
import { DayAssignments } from './DayAssignments';
import { Photos } from './journey/Photos';
import { TripFiles } from './files/TripFiles';
import { Reservations } from './reservation/Reservations';
import { FileLinks } from '../system/FileLinks';
import { PlaceRegions } from './PlaceRegions';
import { JourneyEntries } from './journey/JourneyEntries';
import { DayAccommodations } from './DayAccommodations';
import { IntBaseEntity } from '../base/BaseEntity';

@Index('idx_places_category_id', ['categoryId'], {})
@Index('idx_places_trip_id', ['tripId'], {})
@Entity('places')
export class Places extends IntBaseEntity {
  @Column('int', { name: 'trip_id' })
  tripId: number;

  @Column({ name: 'name' })
  name: string;

  @Column('text', { name: 'description', nullable: true })
  description: string | null;

  @Column({ name: 'lat', nullable: true })
  lat: number | null;

  @Column({ name: 'lng', nullable: true })
  lng: number | null;

  @Column({ name: 'address', nullable: true })
  address: string | null;

  @Column('int', { name: 'category_id', nullable: true })
  categoryId: number | null;

  @Column({ name: 'price', nullable: true })
  price: number | null;

  @Column({ name: 'currency', nullable: true })
  currency: string | null;

  @Column({
    name: 'reservation_status',
    nullable: true,
    default: 'none',
  })
  reservationStatus: string | null;

  @Column('text', { name: 'reservation_notes', nullable: true })
  reservationNotes: string | null;

  @Column({ name: 'reservation_datetime', nullable: true })
  reservationDatetime: string | null;

  @Column({ name: 'place_time', nullable: true })
  placeTime: string | null;

  @Column({ name: 'end_time', nullable: true })
  endTime: string | null;

  @Column('int', {
    name: 'duration_minutes',
    nullable: true,
    default: 60,
  })
  durationMinutes: number | null;

  @Column('text', { name: 'notes', nullable: true })
  notes: string | null;

  @Column('text', { name: 'image_url', nullable: true })
  imageUrl: string | null;

  @Column({ name: 'google_place_id', nullable: true })
  googlePlaceId: string | null;

  @Column({ name: 'website', nullable: true })
  website: string | null;

  @Column('text', { name: 'phone', nullable: true })
  phone: string | null;

  @Column({
    name: 'transport_mode',
    nullable: true,
    default: 'walking',
  })
  transportMode: string | null;

  @Column({ name: 'osm_id', nullable: true })
  osmId: string | null;

  @Column('text', { name: 'route_geometry', nullable: true })
  routeGeometry: string | null;

  @ManyToOne(() => Categories, (categories) => categories.places, {
    onDelete: 'SET NULL',
  })
  @JoinColumn([{ name: 'category_id', referencedColumnName: 'id' }])
  category: Categories;

  @ManyToOne(() => Trips, (trips) => trips.places, { onDelete: 'CASCADE' })
  @JoinColumn([{ name: 'trip_id', referencedColumnName: 'id' }])
  trip: Trips;

  @ManyToMany(() => Tags, (tags) => tags.places)
  tags: Tags[];

  @OneToMany(() => DayAssignments, (dayAssignments) => dayAssignments.place)
  dayAssignments: DayAssignments[];

  @OneToMany(() => Photos, (photos) => photos.place)
  photos: Photos[];

  @OneToMany(() => TripFiles, (tripFiles) => tripFiles.place)
  tripFiles: TripFiles[];

  @OneToMany(() => Reservations, (reservations) => reservations.place)
  reservations: Reservations[];

  @OneToMany(() => FileLinks, (fileLinks) => fileLinks.place)
  fileLinks: FileLinks[];

  @OneToMany(() => PlaceRegions, (placeRegions) => placeRegions.place)
  placeRegions: PlaceRegions[];

  @OneToMany(
    () => JourneyEntries,
    (journeyEntries) => journeyEntries.sourcePlace,
  )
  journeyEntries: JourneyEntries[];

  @OneToMany(
    () => DayAccommodations,
    (dayAccommodations) => dayAccommodations.place,
  )
  dayAccommodations: DayAccommodations[];
}
