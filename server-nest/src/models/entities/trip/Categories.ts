import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { Places } from './Places';
import { IntBaseEntity } from '../base/BaseEntity';
import { SqliteUsers } from '../old-entities/SqliteUsers';

@Entity('categories')
export class Categories extends IntBaseEntity {
  @Column({ name: 'name' })
  name: string;

  @Column({ name: 'color', nullable: true, default: '#6366f1' })
  color: string | null;

  @Column({ name: 'icon', nullable: true, default: '📍' })
  icon: string | null;

  @ManyToOne(() => SqliteUsers, (users) => users.categories, {
    onDelete: 'SET NULL',
  })
  @JoinColumn([{ name: 'user_id', referencedColumnName: 'id' }])
  user: SqliteUsers;

  @OneToMany(() => Places, (places) => places.category)
  places: Places[];
}
