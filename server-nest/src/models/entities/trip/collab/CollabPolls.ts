import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { IntBaseEntity } from '../../base/BaseEntity';
import { SqliteUsers } from '../../old-entities/SqliteUsers';
import { Trips } from '../Trips';
import { CollabPollVotes } from './CollabPollVotes';

@Index('idx_collab_polls_trip', ['tripId'], {})
@Entity('collab_polls')
export class CollabPolls extends IntBaseEntity {
  @Column('int', { name: 'trip_id' })
  tripId: number;

  @Column({ name: 'question' })
  question: string;

  @Column({ name: 'options' })
  options: string;

  @Column('int', { name: 'multiple', nullable: true, default: 0 })
  multiple: number | null;

  @Column('int', { name: 'closed', nullable: true, default: 0 })
  closed: number | null;

  @Column({ name: 'deadline', nullable: true })
  deadline: string | null;

  @ManyToOne(() => SqliteUsers, (users) => users.collabPolls, {
    onDelete: 'CASCADE',
  })
  @JoinColumn([{ name: 'user_id', referencedColumnName: 'id' }])
  user: SqliteUsers;

  @ManyToOne(() => Trips, (trips) => trips.collabPolls, { onDelete: 'CASCADE' })
  @JoinColumn([{ name: 'trip_id', referencedColumnName: 'id' }])
  trip: Trips;

  @OneToMany(() => CollabPollVotes, (collabPollVotes) => collabPollVotes.poll)
  collabPollVotes: CollabPollVotes[];
}
