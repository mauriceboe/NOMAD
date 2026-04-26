import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { VacayPlans } from './VacayPlans';
import { IntBaseEntity } from '../base/BaseEntity';

@Entity('vacay_company_holidays')
export class VacayCompanyHolidays extends IntBaseEntity {
  @Column({ name: 'date' })
  date: string;

  @Column('text', { name: 'note', nullable: true, default: '' })
  note: string | null;

  @ManyToOne(
    () => VacayPlans,
    (vacayPlans) => vacayPlans.vacayCompanyHolidays,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn([{ name: 'plan_id', referencedColumnName: 'id' }])
  plan: VacayPlans;
}
