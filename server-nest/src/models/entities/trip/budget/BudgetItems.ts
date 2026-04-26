import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { IntSortableBaseEntity } from '../../base/BaseEntity';
import { Reservations } from '../reservation/Reservations';
import { SqliteUsers } from '../../old-entities/SqliteUsers';
import { Trips } from '../Trips';
import { BudgetItemMembers } from './BudgetItemMembers';

@Index('idx_budget_items_trip_id', ['tripId'], {})
@Entity('budget_items')
export class BudgetItems extends IntSortableBaseEntity {
  @Column('int', { name: 'trip_id' })
  tripId: number;

  @Column({ name: 'category', default: 'Other' })
  category: string;

  @Column({ name: 'name' })
  name: string;

  @Column({ name: 'total_price', default: 0 })
  totalPrice: number;

  @Column('int', { name: 'persons', nullable: true, default: null })
  persons: number | null;

  @Column('int', { name: 'days', nullable: true, default: null })
  days: number | null;

  @Column('text', { name: 'note', nullable: true })
  note: string | null;

  @Column({
    name: 'expense_date',
    nullable: true,
    default: null,
  })
  expenseDate: string | null;

  @ManyToOne(() => Reservations, (reservations) => reservations.budgetItems, {
    onDelete: 'SET NULL',
  })
  @JoinColumn([{ name: 'reservation_id', referencedColumnName: 'id' }])
  reservation: Reservations;

  @ManyToOne(() => SqliteUsers, (users) => users.budgetItems)
  @JoinColumn([{ name: 'paid_by_user_id', referencedColumnName: 'id' }])
  paidByUser: SqliteUsers;

  @ManyToOne(() => Trips, (trips) => trips.budgetItems, { onDelete: 'CASCADE' })
  @JoinColumn([{ name: 'trip_id', referencedColumnName: 'id' }])
  trip: Trips;

  @OneToMany(
    () => BudgetItemMembers,
    (budgetItemMembers) => budgetItemMembers.budgetItem,
  )
  budgetItemMembers: BudgetItemMembers[];
}
