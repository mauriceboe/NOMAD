import {
  Column,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
} from 'typeorm';
import { Places } from './Places';
import { IntBaseEntity } from '../base/BaseEntity';
import { SqliteUsers } from '../old-entities/SqliteUsers';

@Entity('tags')
export class Tags extends IntBaseEntity {
  @Column({ name: 'name' })
  name: string;

  @Column({ name: 'color', nullable: true, default: () => "'#10b981'" })
  color: string | null;

  @ManyToOne(() => SqliteUsers, (users) => users.tags, { onDelete: 'CASCADE' })
  @JoinColumn([{ name: 'user_id', referencedColumnName: 'id' }])
  user: SqliteUsers;

  @ManyToMany(() => Places, (places) => places.tags)
  @JoinTable({
    name: 'place_tags',
    joinColumns: [{ name: 'tag_id', referencedColumnName: 'id' }],
    inverseJoinColumns: [{ name: 'place_id', referencedColumnName: 'id' }],
  })
  places: Places[];
}
