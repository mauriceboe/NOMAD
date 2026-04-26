import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { Reservations } from '../reservation/Reservations';
import { Places } from '../Places';
import { Trips } from '../Trips';
import { FileLinks } from '../../system/FileLinks';
import { SoftDeletableIntBaseEntity } from '../../base/BaseEntity';
import { SqliteUsers } from '../../old-entities/SqliteUsers';
import { CollabNotes } from '../collab/CollabNotes';

@Index('idx_trip_files_trip_id', ['tripId'], {})
@Entity('trip_files')
export class TripFiles extends SoftDeletableIntBaseEntity {
  @Column('int', { name: 'trip_id' })
  tripId: number;

  @Column({ name: 'filename' })
  filename: string;

  @Column({ name: 'original_name' })
  originalName: string;

  @Column('int', { name: 'file_size', nullable: true })
  fileSize: number | null;

  @Column({ name: 'mime_type', nullable: true })
  mimeType: string | null;

  @Column('text', { name: 'description', nullable: true })
  description: string | null;

  @Column({ name: 'starred', nullable: true, default: false })
  starred: boolean;

  @ManyToOne(() => SqliteUsers, (users) => users.tripFiles, {
    onDelete: 'SET NULL',
  })
  @JoinColumn([{ name: 'uploaded_by', referencedColumnName: 'id' }])
  uploadedBy: SqliteUsers;

  @ManyToOne(() => CollabNotes, (collabNotes) => collabNotes.tripFiles, {
    onDelete: 'SET NULL',
  })
  @JoinColumn([{ name: 'note_id', referencedColumnName: 'id' }])
  note: CollabNotes;

  @ManyToOne(() => Reservations, (reservations) => reservations.tripFiles, {
    onDelete: 'SET NULL',
  })
  @JoinColumn([{ name: 'reservation_id', referencedColumnName: 'id' }])
  reservation: Reservations;

  @ManyToOne(() => Places, (places) => places.tripFiles, {
    onDelete: 'SET NULL',
  })
  @JoinColumn([{ name: 'place_id', referencedColumnName: 'id' }])
  place: Places;

  @ManyToOne(() => Trips, (trips) => trips.tripFiles, { onDelete: 'CASCADE' })
  @JoinColumn([{ name: 'trip_id', referencedColumnName: 'id' }])
  trip: Trips;

  @OneToMany(() => FileLinks, (fileLinks) => fileLinks.file)
  fileLinks: FileLinks[];
}
