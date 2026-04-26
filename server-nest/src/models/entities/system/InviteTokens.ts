import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { IntBaseEntity } from '../base/BaseEntity';
import { SqliteUsers } from '../old-entities/SqliteUsers';

@Entity('invite_tokens')
export class InviteTokens extends IntBaseEntity {
  @Column({ name: 'token', unique: true })
  token: string;

  @Column('int', { name: 'max_uses', default: 1 })
  maxUses: number;

  @Column('int', { name: 'used_count', default: 0 })
  usedCount: number;

  @Column({ name: 'expires_at', nullable: true })
  expiresAt: string | null;

  @ManyToOne(() => SqliteUsers, (users) => users.inviteTokens, {
    onDelete: 'CASCADE',
  })
  @JoinColumn([{ name: 'created_by', referencedColumnName: 'id' }])
  createdBy: SqliteUsers;
}
