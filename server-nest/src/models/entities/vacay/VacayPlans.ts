import { Column, Entity, JoinColumn, OneToMany, OneToOne } from 'typeorm';
import { VacayPlanMembers } from './VacayPlanMembers';
import { VacayUserColors } from './VacayUserColors';
import { VacayYears } from './VacayYears';
import { VacayUserYears } from './VacayUserYears';
import { VacayEntries } from './VacayEntries';
import { VacayCompanyHolidays } from './VacayCompanyHolidays';
import { VacayHolidayCalendars } from './VacayHolidayCalendars';
import { IntBaseEntity } from '../base/BaseEntity';
import { SqliteUsers } from '../old-entities/SqliteUsers';

@Entity('vacay_plans')
export class VacayPlans extends IntBaseEntity {
  @Column({
    name: 'block_weekends',
    nullable: true,
    default: true,
  })
  blockWeekends: boolean;

  @Column({
    name: 'holidays_enabled',
    nullable: true,
    default: false,
  })
  holidaysEnabled: boolean;

  @Column({
    name: 'holidays_region',
    nullable: true,
    default: '',
  })
  holidaysRegion: string | null;

  @Column({
    name: 'company_holidays_enabled',
    nullable: true,
    default: true,
  })
  companyHolidaysEnabled: boolean;

  @Column({
    name: 'carry_over_enabled',
    nullable: true,
    default: true,
  })
  carryOverEnabled: boolean;

  @Column({
    name: 'weekend_days',
    nullable: true,
    default: '0,6',
  })
  weekendDays: string | null;

  @Column('int', { name: 'week_start', default: 1 })
  weekStart: number;

  @OneToOne(() => SqliteUsers, (users) => users.vacayPlans, {
    onDelete: 'CASCADE',
  })
  @JoinColumn([{ name: 'owner_id', referencedColumnName: 'id' }])
  owner: SqliteUsers;

  @OneToMany(
    () => VacayPlanMembers,
    (vacayPlanMembers) => vacayPlanMembers.plan,
  )
  vacayPlanMembers: VacayPlanMembers[];

  @OneToMany(() => VacayUserColors, (vacayUserColors) => vacayUserColors.plan)
  vacayUserColors: VacayUserColors[];

  @OneToMany(() => VacayYears, (vacayYears) => vacayYears.plan)
  vacayYears: VacayYears[];

  @OneToMany(() => VacayUserYears, (vacayUserYears) => vacayUserYears.plan)
  vacayUserYears: VacayUserYears[];

  @OneToMany(() => VacayEntries, (vacayEntries) => vacayEntries.plan)
  vacayEntries: VacayEntries[];

  @OneToMany(
    () => VacayCompanyHolidays,
    (vacayCompanyHolidays) => vacayCompanyHolidays.plan,
  )
  vacayCompanyHolidays: VacayCompanyHolidays[];

  @OneToMany(
    () => VacayHolidayCalendars,
    (vacayHolidayCalendars) => vacayHolidayCalendars.plan,
  )
  vacayHolidayCalendars: VacayHolidayCalendars[];
}
