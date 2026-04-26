import {
  Column,
  Entity,
  JoinColumn,
  ManyToMany,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { PackingItems } from './PackingItems';
import { Trips } from '../Trips';
import { IntSortableBaseEntity } from '../../base/BaseEntity';
import { SqliteUsers } from '../../old-entities/SqliteUsers';

@Entity('packing_bags')
export class PackingBags extends IntSortableBaseEntity {
  @Column({ name: 'name' })
  name: string;

  @Column({ name: 'color', default: () => "'#6366f1'" })
  color: string;

  @Column('int', { name: 'weight_limit_grams', nullable: true })
  weightLimitGrams: number | null;

  @OneToMany(() => PackingItems, (packingItems) => packingItems.bag)
  packingItems: PackingItems[];

  @ManyToOne(() => SqliteUsers, (users) => users.packingBags, {
    onDelete: 'SET NULL',
  })
  @JoinColumn([{ name: 'user_id', referencedColumnName: 'id' }])
  user: SqliteUsers;

  @ManyToOne(() => Trips, (trips) => trips.packingBags, { onDelete: 'CASCADE' })
  @JoinColumn([{ name: 'trip_id', referencedColumnName: 'id' }])
  trip: Trips;

  @ManyToMany(() => SqliteUsers, (users) => users.packingBags2)
  users: SqliteUsers[];
}
