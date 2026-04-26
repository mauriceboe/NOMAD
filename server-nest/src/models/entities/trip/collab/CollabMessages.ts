import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { CollabMessageReactions } from './CollabMessageReactions';
import { SoftDeletableIntBaseEntity } from '../../base/BaseEntity';
import { SqliteUsers } from '../../old-entities/SqliteUsers';
import { Trips } from '../Trips';

@Index('idx_collab_messages_trip', ['tripId'], {})
@Entity('collab_messages')
export class CollabMessages extends SoftDeletableIntBaseEntity {
  @Column('int', { name: 'trip_id' })
  tripId: number;

  @Column('text', { name: 'text' })
  text: string;

  @ManyToOne(
    () => CollabMessages,
    (collabMessages) => collabMessages.collabMessages,
    { onDelete: 'SET NULL' },
  )
  @JoinColumn([{ name: 'reply_to', referencedColumnName: 'id' }])
  replyTo: CollabMessages;

  @OneToMany(() => CollabMessages, (collabMessages) => collabMessages.replyTo)
  collabMessages: CollabMessages[];

  @ManyToOne(() => SqliteUsers, (users) => users.collabMessages, {
    onDelete: 'CASCADE',
  })
  @JoinColumn([{ name: 'user_id', referencedColumnName: 'id' }])
  user: SqliteUsers;

  @ManyToOne(() => Trips, (trips) => trips.collabMessages, {
    onDelete: 'CASCADE',
  })
  @JoinColumn([{ name: 'trip_id', referencedColumnName: 'id' }])
  trip: Trips;

  @OneToMany(
    () => CollabMessageReactions,
    (collabMessageReactions) => collabMessageReactions.message,
  )
  collabMessageReactions: CollabMessageReactions[];
}
