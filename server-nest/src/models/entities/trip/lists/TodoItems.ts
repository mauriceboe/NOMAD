import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { Trips } from '../Trips';
import { IntSortableBaseEntity } from '../../base/BaseEntity';
import { SqliteUsers } from '../../old-entities/SqliteUsers';

@Index('idx_todo_items_trip_id', ['tripId'], {})
@Entity('todo_items')
export class TodoItems extends IntSortableBaseEntity {
  @Column('int', { name: 'trip_id' })
  tripId: number;

  @Column({ name: 'name' })
  name: string;

  @Column({ name: 'checked', nullable: true, default: false })
  checked: boolean;

  @Column({ name: 'category', nullable: true })
  category: string | null;

  @Column({ name: 'due_date', nullable: true })
  dueDate: string | null;

  @Column('text', { name: 'description', nullable: true })
  description: string | null;

  @Column('int', { name: 'priority', default: 0 })
  priority: number;

  @Column('datetime', { name: 'reminded_at', nullable: true })
  remindedAt: Date | null;

  @ManyToOne(() => SqliteUsers, (users) => users.todoItems, {
    onDelete: 'SET NULL',
  })
  @JoinColumn([{ name: 'assigned_user_id', referencedColumnName: 'id' }])
  assignedUser: SqliteUsers;

  @ManyToOne(() => Trips, (trips) => trips.todoItems, { onDelete: 'CASCADE' })
  @JoinColumn([{ name: 'trip_id', referencedColumnName: 'id' }])
  trip: Trips;
}
