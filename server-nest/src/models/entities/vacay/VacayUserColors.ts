import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { VacayPlans } from './VacayPlans';
import { IntBaseEntity } from '../base/BaseEntity';
import { SqliteUsers } from '../old-entities/SqliteUsers';

@Entity('vacay_user_colors')
export class VacayUserColors extends IntBaseEntity {
  @Column({ name: 'color', nullable: true, default: '#6366f1' })
  color: string | null;

  @ManyToOne(() => VacayPlans, (vacayPlans) => vacayPlans.vacayUserColors, {
    onDelete: 'CASCADE',
  })
  @JoinColumn([{ name: 'plan_id', referencedColumnName: 'id' }])
  plan: VacayPlans;

  @ManyToOne(() => SqliteUsers, (users) => users.vacayUserColors, {
    onDelete: 'CASCADE',
  })
  @JoinColumn([{ name: 'user_id', referencedColumnName: 'id' }])
  user: SqliteUsers;
}
