import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { OldOauthConsents } from './OldOauthConsents';
import { OldOauthTokens } from './OldOauthTokens';
import { SqliteUsers } from './SqliteUsers';
import { StringBaseEntity } from '../base/BaseEntity';

@Index('idx_oauth_clients_client_id', ['clientId'], { unique: true })
@Index('idx_oauth_clients_user', ['userId'], {})
@Entity('oauth_clients')
export class OldOauthClients extends StringBaseEntity {
  @Column('int', { name: 'user_id', nullable: true })
  userId: number | null;

  @Column({ name: 'name' })
  name: string;

  @Column({ name: 'client_id', unique: true })
  clientId: string;

  @Column({ name: 'client_secret_hash' })
  clientSecretHash: string;

  @Column('simple-array', { name: 'redirect_uris', default: [] })
  redirectUris: string[];

  @Column('simple-array', { name: 'allowed_scopes', default: [] })
  allowedScopes: string[];

  @Column({ name: 'is_public', default: false })
  isPublic: boolean;

  @Column({ name: 'created_via', default: 'settings_ui' })
  createdVia: string;

  @OneToMany(() => OldOauthConsents, (oauthConsents) => oauthConsents.client)
  oauthConsents: OldOauthConsents[];

  @OneToMany(() => OldOauthTokens, (oauthTokens) => oauthTokens.client)
  oauthTokens: OldOauthTokens[];

  @ManyToOne(() => SqliteUsers, (users) => users.oauthClients, {
    onDelete: 'CASCADE',
  })
  @JoinColumn([{ name: 'user_id', referencedColumnName: 'id' }])
  user: SqliteUsers;
}
