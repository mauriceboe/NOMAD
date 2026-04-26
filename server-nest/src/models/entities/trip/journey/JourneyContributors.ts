import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { Journeys } from './Journeys';
import { TimestampedEntity } from '../../base/BaseEntity';
import { SqliteUsers } from '../../old-entities/SqliteUsers';

@Index('idx_journey_contributors_user', ['userId'], {})
@Entity('journey_contributors')
export class JourneyContributors extends TimestampedEntity {
  @PrimaryColumn('int', { name: 'journey_id' })
  journeyId: number;

  @PrimaryColumn('int', { name: 'user_id' })
  userId: number;

  @Column({ name: 'role' })
  role: string;

  @Column({ name: 'hide_skeletons', default: false })
  hideSkeletons: boolean;

  @ManyToOne(() => SqliteUsers, (users) => users.journeyContributors)
  @JoinColumn([{ name: 'user_id', referencedColumnName: 'id' }])
  user: SqliteUsers;

  @ManyToOne(() => Journeys, (journeys) => journeys.journeyContributors, {
    onDelete: 'CASCADE',
  })
  @JoinColumn([{ name: 'journey_id', referencedColumnName: 'id' }])
  journey: Journeys;
}
