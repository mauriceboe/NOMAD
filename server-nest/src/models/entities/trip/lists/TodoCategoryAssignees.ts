import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { Trips } from '../Trips';
import { IntBaseEntity } from '../../base/BaseEntity';
import { SqliteUsers } from '../../old-entities/SqliteUsers';

@Entity('todo_category_assignees')
export class TodoCategoryAssignees extends IntBaseEntity {
  @Column({ name: 'category_name' })
  categoryName: string;

  @ManyToOne(() => SqliteUsers, (users) => users.todoCategoryAssignees, {
    onDelete: 'CASCADE',
  })
  @JoinColumn([{ name: 'user_id', referencedColumnName: 'id' }])
  user: SqliteUsers;

  @ManyToOne(() => Trips, (trips) => trips.todoCategoryAssignees, {
    onDelete: 'CASCADE',
  })
  @JoinColumn([{ name: 'trip_id', referencedColumnName: 'id' }])
  trip: Trips;
}
