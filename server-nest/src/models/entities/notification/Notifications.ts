import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { IntBaseEntity } from '../base/BaseEntity';
import { SqliteUsers } from '../old-entities/SqliteUsers';

@Index('idx_notifications_target_scope', ['target', 'scope'], {})
@Index('idx_notifications_recipient_created', ['recipientId', 'createdAt'], {})
@Index(
  'idx_notifications_recipient',
  ['recipientId', 'isRead', 'createdAt'],
  {},
)
@Entity('notifications')
export class Notifications extends IntBaseEntity {
  @Column({ name: 'type' })
  type: string;

  @Column({ name: 'scope' })
  scope: string;

  @Column('int', { name: 'target' })
  target: number;

  @Column('int', { name: 'recipient_id' })
  recipientId: number;

  @Column({ name: 'title_key' })
  titleKey: string;

  @Column('simple-json', {
    name: 'title_params',
    nullable: true,
    default: {},
  })
  titleParams: Record<string, unknown> | null;

  @Column({ name: 'text_key' })
  textKey: string;

  @Column('simple-json', {
    name: 'text_params',
    nullable: true,
    default: {},
  })
  textParams: Record<string, unknown> | null;

  @Column({ name: 'positive_text_key', nullable: true })
  positiveTextKey: string | null;

  @Column({ name: 'negative_text_key', nullable: true })
  negativeTextKey: string | null;

  @Column({ name: 'positive_callback', nullable: true })
  positiveCallback: string | null;

  @Column({ name: 'negative_callback', nullable: true })
  negativeCallback: string | null;

  @Column({ name: 'response', nullable: true })
  response: string | null;

  @Column({ name: 'navigate_text_key', nullable: true })
  navigateTextKey: string | null;

  @Column({ name: 'navigate_target', nullable: true })
  navigateTarget: string | null;

  @Column({ name: 'is_read', nullable: true, default: false })
  isRead: boolean | null;

  @ManyToOne(() => SqliteUsers, (users) => users.notifications, {
    onDelete: 'CASCADE',
  })
  @JoinColumn([{ name: 'recipient_id', referencedColumnName: 'id' }])
  recipient: SqliteUsers;

  @ManyToOne(() => SqliteUsers, (users) => users.notifications2, {
    onDelete: 'SET NULL',
  })
  @JoinColumn([{ name: 'sender_id', referencedColumnName: 'id' }])
  sender: SqliteUsers;
}
