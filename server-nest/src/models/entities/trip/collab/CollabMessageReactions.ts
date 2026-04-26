import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { CollabMessages } from './CollabMessages';
import { IntBaseEntity } from '../../base/BaseEntity';
import { SqliteUsers } from '../../old-entities/SqliteUsers';

@Index('idx_collab_reactions_msg', ['messageId'], {})
@Entity('collab_message_reactions')
export class CollabMessageReactions extends IntBaseEntity {
  @Column('int', { name: 'message_id' })
  messageId: number;

  @Column({ name: 'emoji' })
  emoji: string;

  @ManyToOne(() => SqliteUsers, (users) => users.collabMessageReactions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn([{ name: 'user_id', referencedColumnName: 'id' }])
  user: SqliteUsers;

  @ManyToOne(
    () => CollabMessages,
    (collabMessages) => collabMessages.collabMessageReactions,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn([{ name: 'message_id', referencedColumnName: 'id' }])
  message: CollabMessages;
}
