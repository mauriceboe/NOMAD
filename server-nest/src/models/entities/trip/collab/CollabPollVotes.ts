import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { IntBaseEntity } from '../../base/BaseEntity';
import { SqliteUsers } from '../../old-entities/SqliteUsers';
import { CollabPolls } from './CollabPolls';

@Entity('collab_poll_votes')
export class CollabPollVotes extends IntBaseEntity {
  @Column('int', { name: 'option_index' })
  optionIndex: number;

  @ManyToOne(() => SqliteUsers, (users) => users.collabPollVotes, {
    onDelete: 'CASCADE',
  })
  @JoinColumn([{ name: 'user_id', referencedColumnName: 'id' }])
  user: SqliteUsers;

  @ManyToOne(() => CollabPolls, (collabPolls) => collabPolls.collabPollVotes, {
    onDelete: 'CASCADE',
  })
  @JoinColumn([{ name: 'poll_id', referencedColumnName: 'id' }])
  poll: CollabPolls;
}
