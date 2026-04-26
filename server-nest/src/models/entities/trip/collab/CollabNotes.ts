import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { IntBaseEntity } from '../../base/BaseEntity';
import { TripFiles } from '../files/TripFiles';
import { SqliteUsers } from '../../old-entities/SqliteUsers';
import { Trips } from '../Trips';

@Index('idx_collab_notes_trip', ['tripId'], {})
@Entity('collab_notes')
export class CollabNotes extends IntBaseEntity {
  @Column('int', { name: 'trip_id' })
  tripId: number;

  @Column({
    name: 'category',
    nullable: true,
    default: 'General',
  })
  category: string | null;

  @Column({ name: 'title' })
  title: string;

  @Column('text', { name: 'content', nullable: true })
  content: string | null;

  @Column({ name: 'color', nullable: true, default: '#6366f1' })
  color: string | null;

  @Column('int', { name: 'pinned', nullable: true, default: 0 })
  pinned: number | null;

  @Column({ name: 'website', nullable: true })
  website: string | null;

  @OneToMany(() => TripFiles, (tripFiles) => tripFiles.note)
  tripFiles: TripFiles[];

  @ManyToOne(() => SqliteUsers, (users) => users.collabNotes, {
    onDelete: 'CASCADE',
  })
  @JoinColumn([{ name: 'user_id', referencedColumnName: 'id' }])
  user: SqliteUsers;

  @ManyToOne(() => Trips, (trips) => trips.collabNotes, { onDelete: 'CASCADE' })
  @JoinColumn([{ name: 'trip_id', referencedColumnName: 'id' }])
  trip: Trips;
}
