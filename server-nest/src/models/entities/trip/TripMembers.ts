import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { Trips } from './Trips';
import { IntBaseEntity } from '../base/BaseEntity';
import { SqliteUsers } from '../old-entities/SqliteUsers';

@Index('idx_trip_members_user_id', ['userId'], {})
@Index('idx_trip_members_trip_id', ['tripId'], {})
@Entity('trip_members')
export class TripMembers extends IntBaseEntity {
  @Column('int', { name: 'trip_id' })
  tripId: number;

  @Column('int', { name: 'user_id' })
  userId: number;

  @ManyToOne(() => SqliteUsers, (users) => users.tripMembers)
  @JoinColumn([{ name: 'invited_by', referencedColumnName: 'id' }])
  invitedBy: SqliteUsers;

  @ManyToOne(() => SqliteUsers, (users) => users.tripMembers2, {
    onDelete: 'CASCADE',
  })
  @JoinColumn([{ name: 'user_id', referencedColumnName: 'id' }])
  user: SqliteUsers;

  @ManyToOne(() => Trips, (trips) => trips.tripMembers, { onDelete: 'CASCADE' })
  @JoinColumn([{ name: 'trip_id', referencedColumnName: 'id' }])
  trip: Trips;
}
