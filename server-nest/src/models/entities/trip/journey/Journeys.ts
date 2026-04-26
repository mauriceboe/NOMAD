import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
} from 'typeorm';
import { JourneyTrips } from './JourneyTrips';
import { JourneyEntries } from './JourneyEntries';
import { JourneyContributors } from './JourneyContributors';
import { JourneyShareTokens } from './JourneyShareTokens';
import { JourneyPhotos } from './JourneyPhotos';
import { IntBaseEntity } from '../../base/BaseEntity';
import { SqliteUsers } from '../../old-entities/SqliteUsers';

@Index('idx_journeys_user', ['userId'], {})
@Entity('journeys')
export class Journeys extends IntBaseEntity {
  @Column('int', { name: 'user_id' })
  userId: number;

  @Column({ name: 'title' })
  title: string;

  @Column({ name: 'subtitle', nullable: true })
  subtitle: string | null;

  @Column({ name: 'cover_gradient', nullable: true })
  coverGradient: string | null;

  @Column({ name: 'status', nullable: true, default: 'draft' })
  status: string | null;

  @Column({ name: 'cover_image', nullable: true })
  coverImage: string | null;

  @ManyToOne(() => SqliteUsers, (users) => users.journeys)
  @JoinColumn([{ name: 'user_id', referencedColumnName: 'id' }])
  user: SqliteUsers;

  @OneToMany(() => JourneyTrips, (journeyTrips) => journeyTrips.journey)
  journeyTrips: JourneyTrips[];

  @OneToMany(() => JourneyEntries, (journeyEntries) => journeyEntries.journey)
  journeyEntries: JourneyEntries[];

  @OneToMany(
    () => JourneyContributors,
    (journeyContributors) => journeyContributors.journey,
  )
  journeyContributors: JourneyContributors[];

  @OneToOne(
    () => JourneyShareTokens,
    (journeyShareTokens) => journeyShareTokens.journey,
  )
  journeyShareTokens: JourneyShareTokens;

  @OneToMany(() => JourneyPhotos, (journeyPhotos) => journeyPhotos.journey)
  journeyPhotos: JourneyPhotos[];
}
