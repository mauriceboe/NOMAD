import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { VacayPlans } from './VacayPlans';
import { IntBaseEntity } from '../base/BaseEntity';

@Entity('vacay_years')
export class VacayYears extends IntBaseEntity {
  @Column('integer', { name: 'year' })
  year: number;

  @ManyToOne(() => VacayPlans, (vacayPlans) => vacayPlans.vacayYears, {
    onDelete: 'CASCADE',
  })
  @JoinColumn([{ name: 'plan_id', referencedColumnName: 'id' }])
  plan: VacayPlans;
}
