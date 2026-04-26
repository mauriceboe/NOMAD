import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { IntBaseEntity } from '../base/BaseEntity';
import { SqliteUsers } from '../old-entities/SqliteUsers';

@Entity('settings')
export class Settings extends IntBaseEntity {
  @Column({ name: 'key' })
  key: string;

  @Column({ name: 'value', nullable: true })
  value: string | null;

  @ManyToOne(() => SqliteUsers, (users) => users.settings, {
    onDelete: 'CASCADE',
  })
  @JoinColumn([{ name: 'user_id', referencedColumnName: 'id' }])
  user: SqliteUsers;
}
