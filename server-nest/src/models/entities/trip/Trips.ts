import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { Days } from './Days';
import { Places } from './Places';
import { PackingItems } from './lists/PackingItems';
import { Photos } from './journey/Photos';
import { TripFiles } from './files/TripFiles';
import { Reservations } from './reservation/Reservations';
import { TripMembers } from './TripMembers';
import { DayNotes } from './DayNotes';
import { PackingCategoryAssignees } from './lists/PackingCategoryAssignees';
import { PackingBags } from './lists/PackingBags';
import { ShareTokens } from './ShareTokens';
import { TripAlbumLinks } from './journey/TripAlbumLinks';
import { TodoItems } from './lists/TodoItems';
import { TodoCategoryAssignees } from './lists/TodoCategoryAssignees';
import { JourneyTrips } from './journey/JourneyTrips';
import { JourneyEntries } from './journey/JourneyEntries';
import { TripPhotos } from './TripPhotos';
import { DayAccommodations } from './DayAccommodations';
import { IntBaseEntity } from '../base/BaseEntity';
import { SqliteUsers } from '../old-entities/SqliteUsers';
import { BudgetItems } from './budget/BudgetItems';
import { CollabNotes } from './collab/CollabNotes';
import { CollabPolls } from './collab/CollabPolls';
import { CollabMessages } from './collab/CollabMessages';
import { BudgetCategoryOrder } from './budget/BudgetCategoryOrder';

@Index('idx_trips_created_at', ['createdAt'], {})
@Index('idx_trips_user_id', ['userId'], {})
@Entity('trips')
export class Trips extends IntBaseEntity {
  @Column('int', { name: 'user_id' })
  userId: number;

  @Column({ name: 'title' })
  title: string;

  @Column('text', { name: 'description', nullable: true })
  description: string | null;

  @Column({ name: 'start_date', nullable: true })
  startDate: string | null;

  @Column({ name: 'end_date', nullable: true })
  endDate: string | null;

  @Column({ name: 'currency', nullable: true, default: 'EUR' })
  currency: string | null;

  @Column({ name: 'cover_image', nullable: true })
  coverImage: string | null;

  @Column({
    name: 'is_archived',
    nullable: true,
    default: false,
  })
  isArchived: boolean;

  @Column('int', {
    name: 'reminder_days',
    nullable: true,
    default: 3,
  })
  reminderDays: number | null;

  @ManyToOne(() => SqliteUsers, (users) => users.trips, { onDelete: 'CASCADE' })
  @JoinColumn([{ name: 'user_id', referencedColumnName: 'id' }])
  user: SqliteUsers;

  @OneToMany(() => Days, (days) => days.trip)
  days: Days[];

  @OneToMany(() => Places, (places) => places.trip)
  places: Places[];

  @OneToMany(() => PackingItems, (packingItems) => packingItems.trip)
  packingItems: PackingItems[];

  @OneToMany(() => Photos, (photos) => photos.trip)
  photos: Photos[];

  @OneToMany(() => TripFiles, (tripFiles) => tripFiles.trip)
  tripFiles: TripFiles[];

  @OneToMany(() => Reservations, (reservations) => reservations.trip)
  reservations: Reservations[];

  @OneToMany(() => TripMembers, (tripMembers) => tripMembers.trip)
  tripMembers: TripMembers[];

  @OneToMany(() => DayNotes, (dayNotes) => dayNotes.trip)
  dayNotes: DayNotes[];

  @OneToMany(() => BudgetItems, (budgetItems) => budgetItems.trip)
  budgetItems: BudgetItems[];

  @OneToMany(() => CollabNotes, (collabNotes) => collabNotes.trip)
  collabNotes: CollabNotes[];

  @OneToMany(() => CollabPolls, (collabPolls) => collabPolls.trip)
  collabPolls: CollabPolls[];

  @OneToMany(() => CollabMessages, (collabMessages) => collabMessages.trip)
  collabMessages: CollabMessages[];

  @OneToMany(
    () => PackingCategoryAssignees,
    (packingCategoryAssignees) => packingCategoryAssignees.trip,
  )
  packingCategoryAssignees: PackingCategoryAssignees[];

  @OneToMany(() => PackingBags, (packingBags) => packingBags.trip)
  packingBags: PackingBags[];

  @OneToMany(() => ShareTokens, (shareTokens) => shareTokens.trip)
  shareTokens: ShareTokens[];

  @OneToMany(() => TripAlbumLinks, (tripAlbumLinks) => tripAlbumLinks.trip)
  tripAlbumLinks: TripAlbumLinks[];

  @OneToMany(() => TodoItems, (todoItems) => todoItems.trip)
  todoItems: TodoItems[];

  @OneToMany(
    () => TodoCategoryAssignees,
    (todoCategoryAssignees) => todoCategoryAssignees.trip,
  )
  todoCategoryAssignees: TodoCategoryAssignees[];

  @OneToMany(
    () => BudgetCategoryOrder,
    (budgetCategoryOrder) => budgetCategoryOrder.trip,
  )
  budgetCategoryOrders: BudgetCategoryOrder[];

  @OneToMany(() => JourneyTrips, (journeyTrips) => journeyTrips.trip)
  journeyTrips: JourneyTrips[];

  @OneToMany(
    () => JourneyEntries,
    (journeyEntries) => journeyEntries.sourceTrip,
  )
  journeyEntries: JourneyEntries[];

  @OneToMany(() => TripPhotos, (tripPhotos) => tripPhotos.trip)
  tripPhotos: TripPhotos[];

  @OneToMany(
    () => DayAccommodations,
    (dayAccommodations) => dayAccommodations.trip,
  )
  dayAccommodations: DayAccommodations[];
}
