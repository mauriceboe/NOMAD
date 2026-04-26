import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { VacayPlans } from './VacayPlans';
import { IntBaseEntity } from '../base/BaseEntity';
import { SqliteUsers } from '../old-entities/SqliteUsers';

@Entity('vacay_plan_members')
export class VacayPlanMembers extends IntBaseEntity {
  @Column({
    name: 'status',
    nullable: true,
    default: 'pending',
  })
  status: string | null;

  @ManyToOne(() => SqliteUsers, (users) => users.vacayPlanMembers, {
    onDelete: 'CASCADE',
  })
  @JoinColumn([{ name: 'user_id', referencedColumnName: 'id' }])
  user: SqliteUsers;

  @ManyToOne(() => VacayPlans, (vacayPlans) => vacayPlans.vacayPlanMembers, {
    onDelete: 'CASCADE',
  })
  @JoinColumn([{ name: 'plan_id', referencedColumnName: 'id' }])
  plan: VacayPlans;
}
