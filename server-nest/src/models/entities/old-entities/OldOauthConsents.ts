import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { SqliteUsers } from './SqliteUsers';
import { OldOauthClients } from './OldOauthClients';
import { IntBaseEntity } from '../base/BaseEntity';

@Entity('oauth_consents')
export class OldOauthConsents extends IntBaseEntity {
  @Column('simple-array', { name: 'scopes', default: [] })
  scopes: string[];

  @ManyToOne(() => SqliteUsers, (users) => users.oauthConsents, {
    onDelete: 'CASCADE',
  })
  @JoinColumn([{ name: 'user_id', referencedColumnName: 'id' }])
  user: SqliteUsers;

  @ManyToOne(
    () => OldOauthClients,
    (oauthClients) => oauthClients.oauthConsents,
    {
      onDelete: 'CASCADE',
    },
  )
  @JoinColumn([{ name: 'client_id', referencedColumnName: 'clientId' }])
  client: OldOauthClients;
}
