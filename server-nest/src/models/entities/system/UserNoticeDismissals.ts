import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { TimestampedEntity } from '../base/BaseEntity';
import { SqliteUsers } from '../old-entities/SqliteUsers';

@Entity('user_notice_dismissals')
export class UserNoticeDismissals extends TimestampedEntity {
  @PrimaryColumn('int', { name: 'user_id' })
  userId: number;

  @PrimaryColumn({ name: 'notice_id' })
  noticeId: string;

  @Column('int', { name: 'dismissed_at' })
  dismissedAt: number;

  @ManyToOne(() => SqliteUsers, (users) => users.userNoticeDismissals, {
    onDelete: 'CASCADE',
  })
  @JoinColumn([{ name: 'user_id', referencedColumnName: 'id' }])
  user: SqliteUsers;
}
