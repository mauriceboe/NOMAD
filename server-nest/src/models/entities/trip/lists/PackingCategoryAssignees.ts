import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { Trips } from '../Trips';
import { IntBaseEntity } from '../../base/BaseEntity';
import { SqliteUsers } from '../../old-entities/SqliteUsers';

@Entity('packing_category_assignees')
export class PackingCategoryAssignees extends IntBaseEntity {
  @Column({ name: 'category_name' })
  categoryName: string;

  @ManyToOne(() => SqliteUsers, (users) => users.packingCategoryAssignees, {
    onDelete: 'CASCADE',
  })
  @JoinColumn([{ name: 'user_id', referencedColumnName: 'id' }])
  user: SqliteUsers;

  @ManyToOne(() => Trips, (trips) => trips.packingCategoryAssignees, {
    onDelete: 'CASCADE',
  })
  @JoinColumn([{ name: 'trip_id', referencedColumnName: 'id' }])
  trip: Trips;
}
