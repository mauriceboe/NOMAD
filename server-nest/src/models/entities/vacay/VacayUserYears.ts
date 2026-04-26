import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { VacayPlans } from './VacayPlans';
import { IntBaseEntity } from '../base/BaseEntity';
import { SqliteUsers } from '../old-entities/SqliteUsers';

@Entity('vacay_user_years')
export class VacayUserYears extends IntBaseEntity {
  @Column('int', { name: 'year' })
  year: number;

  @Column('int', {
    name: 'vacation_days',
    nullable: true,
    default: 30,
  })
  vacationDays: number | null;

  @Column('int', {
    name: 'carried_over',
    nullable: true,
    default: 0,
  })
  carriedOver: number | null;

  @ManyToOne(() => VacayPlans, (vacayPlans) => vacayPlans.vacayUserYears, {
    onDelete: 'CASCADE',
  })
  @JoinColumn([{ name: 'plan_id', referencedColumnName: 'id' }])
  plan: VacayPlans;

  @ManyToOne(() => SqliteUsers, (users) => users.vacayUserYears, {
    onDelete: 'CASCADE',
  })
  @JoinColumn([{ name: 'user_id', referencedColumnName: 'id' }])
  user: SqliteUsers;
}
