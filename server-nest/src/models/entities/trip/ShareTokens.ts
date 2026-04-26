import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { Trips } from './Trips';
import { IntBaseEntity } from '../base/BaseEntity';
import { SqliteUsers } from '../old-entities/SqliteUsers';

@Index('idx_share_tokens_token', ['token'], {})
@Entity('share_tokens')
export class ShareTokens extends IntBaseEntity {
  @Column({ name: 'token', unique: true })
  token: string;

  @Column({ name: 'share_map', default: true })
  shareMap: boolean;

  @Column({
    name: 'share_bookings',
    default: true,
  })
  shareBookings: boolean;

  @Column({
    name: 'share_packing',
    default: false,
  })
  sharePacking: boolean;

  @Column({
    name: 'share_budget',
    default: false,
  })
  shareBudget: boolean;

  @Column({
    name: 'share_collab',
    default: false,
  })
  shareCollab: boolean;

  @Column({ name: 'expires_at', nullable: true })
  expiresAt: string | null;

  @ManyToOne(() => SqliteUsers, (users) => users.shareTokens)
  @JoinColumn([{ name: 'created_by', referencedColumnName: 'id' }])
  createdBy: SqliteUsers;

  @ManyToOne(() => Trips, (trips) => trips.shareTokens, { onDelete: 'CASCADE' })
  @JoinColumn([{ name: 'trip_id', referencedColumnName: 'id' }])
  trip: Trips;
}
