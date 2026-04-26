import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { IntBaseEntity } from '../base/BaseEntity';
import { SqliteUsers } from '../old-entities/SqliteUsers';

@Index('idx_mcp_tokens_hash', ['tokenHash'], { unique: true })
@Entity('mcp_tokens')
export class McpTokens extends IntBaseEntity {
  @Column({ name: 'name' })
  name: string;

  @Column({ name: 'token_hash', unique: true })
  tokenHash: string;

  @Column({ name: 'token_prefix' })
  tokenPrefix: string;

  @Column({ name: 'last_used_at', nullable: true })
  lastUsedAt: Date | null;

  @ManyToOne(() => SqliteUsers, (users) => users.mcpTokens, {
    onDelete: 'CASCADE',
  })
  @JoinColumn([{ name: 'user_id', referencedColumnName: 'id' }])
  user: SqliteUsers;
}
