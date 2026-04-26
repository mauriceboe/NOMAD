import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { IntBaseEntity } from '../base/BaseEntity';
import { SqliteUsers } from '../old-entities/SqliteUsers';

@Index('idx_audit_log_created', ['createdAt'], {})
@Entity('audit_log')
export class AuditLog extends IntBaseEntity {
  @Column({ name: 'action' })
  action: string;

  @Column({ name: 'resource', nullable: true })
  resource: string | null;

  @Column('simple-json', { name: 'details', nullable: true })
  details: Record<string, unknown> | null;

  @Column({ name: 'ip', nullable: true })
  ip: string | null;

  @ManyToOne(() => SqliteUsers, (users) => users.auditLogs, {
    onDelete: 'SET NULL',
  })
  @JoinColumn([{ name: 'user_id', referencedColumnName: 'id' }])
  user: SqliteUsers;
}
