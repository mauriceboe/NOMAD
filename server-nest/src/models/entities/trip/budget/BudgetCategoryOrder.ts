import { Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Trips } from '../Trips';
import { TimestampedSortableEntity } from '../../base/BaseEntity';

@Entity('budget_category_order')
export class BudgetCategoryOrder extends TimestampedSortableEntity {
  @PrimaryColumn('int', { name: 'trip_id' })
  tripId: number;

  @PrimaryColumn({ name: 'category' })
  category: string;

  @ManyToOne(() => Trips, (trips) => trips.budgetCategoryOrders, {
    onDelete: 'CASCADE',
  })
  @JoinColumn([{ name: 'trip_id', referencedColumnName: 'id' }])
  trip: Trips;
}
