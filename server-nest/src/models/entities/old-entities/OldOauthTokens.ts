import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { SqliteUsers } from './SqliteUsers';
import { OldOauthClients } from './OldOauthClients';
import { IntBaseEntity } from '../base/BaseEntity';

@Index('idx_oauth_tokens_parent', ['parentTokenId'], {})
@Index('idx_oauth_tokens_refresh', ['refreshTokenHash'], { unique: true })
@Index('idx_oauth_tokens_access', ['accessTokenHash'], { unique: true })
@Index('idx_oauth_tokens_user', ['userId'], {})
@Entity('oauth_tokens')
export class OldOauthTokens extends IntBaseEntity {
  @Column('int', { name: 'user_id' })
  userId: number;

  @Column({ name: 'access_token_hash', unique: true })
  accessTokenHash: string;

  @Column({ name: 'refresh_token_hash', unique: true })
  refreshTokenHash: string;

  @Column('simple-array', { name: 'scopes', default: [] })
  scopes: string[];

  @Column('datetime', { name: 'access_token_expires_at' })
  accessTokenExpiresAt: Date;

  @Column('datetime', { name: 'refresh_token_expires_at' })
  refreshTokenExpiresAt: Date;

  @Column('datetime', { name: 'revoked_at', nullable: true })
  revokedAt: Date | null;

  @Column('int', { name: 'parent_token_id', nullable: true })
  parentTokenId: number | null;

  @Column({ name: 'audience', nullable: true })
  audience: string | null;

  @ManyToOne(() => OldOauthTokens, (oauthTokens) => oauthTokens.oauthTokens)
  @JoinColumn([{ name: 'parent_token_id', referencedColumnName: 'id' }])
  parentToken: OldOauthTokens;

  @OneToMany(() => OldOauthTokens, (oauthTokens) => oauthTokens.parentToken)
  oauthTokens: OldOauthTokens[];

  @ManyToOne(() => SqliteUsers, (users) => users.oauthTokens, {
    onDelete: 'CASCADE',
  })
  @JoinColumn([{ name: 'user_id', referencedColumnName: 'id' }])
  user: SqliteUsers;

  @ManyToOne(
    () => OldOauthClients,
    (oauthClients) => oauthClients.oauthTokens,
    {
      onDelete: 'CASCADE',
    },
  )
  @JoinColumn([{ name: 'client_id', referencedColumnName: 'clientId' }])
  client: OldOauthClients;
}
