import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { VacayPlans } from './VacayPlans';
import { IntSortableBaseEntity } from '../base/BaseEntity';

@Entity('vacay_holiday_calendars')
export class VacayHolidayCalendars extends IntSortableBaseEntity {
  @Column({ name: 'region' })
  region: string;

  @Column({ name: 'label', nullable: true })
  label: string | null;

  @Column({ name: 'color', default: '#fecaca' })
  color: string;

  @ManyToOne(
    () => VacayPlans,
    (vacayPlans) => vacayPlans.vacayHolidayCalendars,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn([{ name: 'plan_id', referencedColumnName: 'id' }])
  plan: VacayPlans;
}
