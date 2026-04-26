import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { Trips } from './Trips';
import { Days } from './Days';
import { IntSortableBaseEntity } from '../base/BaseEntity';

@Index('idx_day_notes_day_id', ['dayId'], {})
@Entity('day_notes')
export class DayNotes extends IntSortableBaseEntity {
  @Column('int', { name: 'day_id' })
  dayId: number;

  @Column('text', { name: 'text' })
  text: string;

  @Column({ name: 'time', nullable: true })
  time: string | null;

  @Column({ name: 'icon', nullable: true, default: '📝' })
  icon: string | null;

  @ManyToOne(() => Trips, (trips) => trips.dayNotes, { onDelete: 'CASCADE' })
  @JoinColumn([{ name: 'trip_id', referencedColumnName: 'id' }])
  trip: Trips;

  @ManyToOne(() => Days, (days) => days.dayNotes, { onDelete: 'CASCADE' })
  @JoinColumn([{ name: 'day_id', referencedColumnName: 'id' }])
  day: Days;
}
