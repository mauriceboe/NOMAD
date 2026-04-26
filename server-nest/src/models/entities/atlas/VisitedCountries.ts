import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { IntBaseEntity } from '../base/BaseEntity';
import { SqliteUsers } from '../old-entities/SqliteUsers';

@Entity('visited_countries')
export class VisitedCountries extends IntBaseEntity {
  @Column('text', { name: 'country_code' })
  countryCode: string;

  @ManyToOne(() => SqliteUsers, (users) => users.visitedCountries, {
    onDelete: 'CASCADE',
  })
  @JoinColumn([{ name: 'user_id', referencedColumnName: 'id' }])
  user: SqliteUsers;
}
