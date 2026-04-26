import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { VacayPlans } from './VacayPlans';
import { IntBaseEntity } from '../base/BaseEntity';
import { SqliteUsers } from '../old-entities/SqliteUsers';

@Entity('vacay_entries')
export class VacayEntries extends IntBaseEntity {
  @Column({ name: 'date' })
  date: string;

  @Column('text', { name: 'note', nullable: true, default: '' })
  note: string | null;

  @ManyToOne(() => SqliteUsers, (users) => users.vacayEntries, {
    onDelete: 'CASCADE',
  })
  @JoinColumn([{ name: 'user_id', referencedColumnName: 'id' }])
  user: SqliteUsers;

  @ManyToOne(() => VacayPlans, (vacayPlans) => vacayPlans.vacayEntries, {
    onDelete: 'CASCADE',
  })
  @JoinColumn([{ name: 'plan_id', referencedColumnName: 'id' }])
  plan: VacayPlans;
}
