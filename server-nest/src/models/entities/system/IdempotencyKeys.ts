import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { TimestampedEntity } from '../base/BaseEntity';
import { SqliteUsers } from '../old-entities/SqliteUsers';

@Index('idx_idempotency_keys_created', ['createdAt'], {})
@Entity('idempotency_keys')
export class IdempotencyKeys extends TimestampedEntity {
  @PrimaryColumn({ name: 'key' })
  key: string;

  @PrimaryColumn('int', { name: 'user_id' })
  userId: number;

  @PrimaryColumn({ name: 'method' })
  method: string;

  @PrimaryColumn('text', { name: 'path' })
  path: string;

  @Column('int', { name: 'status_code' })
  statusCode: number;

  @Column('text', { name: 'response_body' })
  responseBody: string;

  @ManyToOne(() => SqliteUsers, (users) => users.idempotencyKeys, {
    onDelete: 'CASCADE',
  })
  @JoinColumn([{ name: 'user_id', referencedColumnName: 'id' }])
  user: SqliteUsers;
}
