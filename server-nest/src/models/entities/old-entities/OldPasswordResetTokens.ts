import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { SqliteUsers } from './SqliteUsers';
import { IntBaseEntity } from '../base/BaseEntity';

@Index('idx_prt_hash', ['tokenHash'], {})
@Index('idx_prt_user', ['userId'], {})
@Entity('password_reset_tokens')
export class OldPasswordResetTokens extends IntBaseEntity {
  @Column('int', { name: 'user_id' })
  userId: number;

  @Column({ name: 'token_hash', unique: true })
  tokenHash: string;

  @Column({ name: 'expires_at' })
  expiresAt: Date;

  @Column({ name: 'consumed_at', nullable: true })
  consumedAt: Date | null;

  @Column({ name: 'created_ip', nullable: true })
  createdIp: string | null;

  @ManyToOne(() => SqliteUsers, (users) => users.passwordResetTokens, {
    onDelete: 'CASCADE',
  })
  @JoinColumn([{ name: 'user_id', referencedColumnName: 'id' }])
  user: SqliteUsers;
}
