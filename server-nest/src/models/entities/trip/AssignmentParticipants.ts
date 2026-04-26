import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { DayAssignments } from './DayAssignments';
import { IntBaseEntity } from '../base/BaseEntity';
import { SqliteUsers } from '../old-entities/SqliteUsers';

@Index('idx_assignment_participants_assignment', ['assignmentId'], {})
@Entity('assignment_participants')
export class AssignmentParticipants extends IntBaseEntity {
  @Column('int', { name: 'assignment_id' })
  assignmentId: number;

  @ManyToOne(() => SqliteUsers, (users) => users.assignmentParticipants, {
    onDelete: 'CASCADE',
  })
  @JoinColumn([{ name: 'user_id', referencedColumnName: 'id' }])
  user: SqliteUsers;

  @ManyToOne(
    () => DayAssignments,
    (dayAssignments) => dayAssignments.assignmentParticipants,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn([{ name: 'assignment_id', referencedColumnName: 'id' }])
  assignment: DayAssignments;
}
