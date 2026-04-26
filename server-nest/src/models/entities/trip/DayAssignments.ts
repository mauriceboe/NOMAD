import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { Places } from './Places';
import { Days } from './Days';
import { AssignmentParticipants } from './AssignmentParticipants';
import { IntBaseEntity } from '../base/BaseEntity';
import { Reservations } from './reservation/Reservations';
import { FileLinks } from '../system/FileLinks';

@Index('idx_day_assignments_place_id', ['placeId'], {})
@Index('idx_day_assignments_day_id', ['dayId'], {})
@Entity('day_assignments')
export class DayAssignments extends IntBaseEntity {
  @Column('int', { name: 'day_id' })
  dayId: number;

  @Column('int', { name: 'place_id' })
  placeId: number;

  @Column('int', {
    name: 'order_index',
    nullable: true,
    default: 0,
  })
  orderIndex: number | null;

  @Column('text', { name: 'notes', nullable: true })
  notes: string | null;

  @Column({
    name: 'reservation_status',
    nullable: true,
    default: 'none',
  })
  reservationStatus: string | null;

  @Column('text', { name: 'reservation_notes', nullable: true })
  reservationNotes: string | null;

  @Column({ name: 'reservation_datetime', nullable: true })
  reservationDatetime: string | null;

  @Column({ name: 'assignment_time', nullable: true })
  assignmentTime: string | null;

  @Column({ name: 'assignment_end_time', nullable: true })
  assignmentEndTime: string | null;

  @ManyToOne(() => Places, (places) => places.dayAssignments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn([{ name: 'place_id', referencedColumnName: 'id' }])
  place: Places;

  @ManyToOne(() => Days, (days) => days.dayAssignments, { onDelete: 'CASCADE' })
  @JoinColumn([{ name: 'day_id', referencedColumnName: 'id' }])
  day: Days;

  @OneToMany(() => Reservations, (reservations) => reservations.assignment)
  reservations: Reservations[];

  @OneToMany(
    () => AssignmentParticipants,
    (assignmentParticipants) => assignmentParticipants.assignment,
  )
  assignmentParticipants: AssignmentParticipants[];

  @OneToMany(() => FileLinks, (fileLinks) => fileLinks.assignment)
  fileLinks: FileLinks[];
}
