import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { SqliteUsers } from '../old-entities/SqliteUsers';

@Index('idx_ncp_user', ['userId'], {})
@Entity('notification_channel_preferences')
export class NotificationChannelPreferences {
  @PrimaryColumn('int', { name: 'user_id' })
  userId: number;

  @PrimaryColumn({ name: 'event_type' })
  eventType: string;

  @PrimaryColumn({ name: 'channel' })
  channel: string;

  @Column({ name: 'enabled', default: true })
  enabled: boolean;

  @ManyToOne(
    () => SqliteUsers,
    (users) => users.notificationChannelPreferences,
    {
      onDelete: 'CASCADE',
    },
  )
  @JoinColumn([{ name: 'user_id', referencedColumnName: 'id' }])
  user: SqliteUsers;
}
