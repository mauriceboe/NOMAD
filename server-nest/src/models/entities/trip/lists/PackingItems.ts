import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { PackingBags } from './PackingBags';
import { Trips } from '../Trips';
import { IntSortableBaseEntity } from '../../base/BaseEntity';

@Index('idx_packing_items_trip_id', ['tripId'], {})
@Entity('packing_items')
export class PackingItems extends IntSortableBaseEntity {
  @Column('int', { name: 'trip_id' })
  tripId: number;

  @Column({ name: 'name' })
  name: string;

  @Column({ name: 'checked', nullable: true, default: false })
  checked: boolean;

  @Column({ name: 'category', nullable: true })
  category: string | null;

  @Column('int', { name: 'weight_grams', nullable: true })
  weightGrams: number | null;

  @Column('int', { name: 'quantity', default: 1 })
  quantity: number;

  @ManyToOne(() => PackingBags, (packingBags) => packingBags.packingItems, {
    onDelete: 'SET NULL',
  })
  @JoinColumn([{ name: 'bag_id', referencedColumnName: 'id' }])
  bag: PackingBags;

  @ManyToOne(() => Trips, (trips) => trips.packingItems, {
    onDelete: 'CASCADE',
  })
  @JoinColumn([{ name: 'trip_id', referencedColumnName: 'id' }])
  trip: Trips;
}
