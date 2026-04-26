import { Entity, JoinColumn, ManyToOne } from 'typeorm';
import { Places } from '../trip/Places';
import { Reservations } from '../trip/reservation/Reservations';
import { TripFiles } from '../trip/files/TripFiles';
import { IntBaseEntity } from '../base/BaseEntity';
import { DayAssignments } from '../trip/DayAssignments';

@Entity('file_links')
export class FileLinks extends IntBaseEntity {
  @ManyToOne(() => Places, (places) => places.fileLinks, {
    onDelete: 'CASCADE',
  })
  @JoinColumn([{ name: 'place_id', referencedColumnName: 'id' }])
  place: Places;

  @ManyToOne(
    () => DayAssignments,
    (dayAssignments) => dayAssignments.fileLinks,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn([{ name: 'assignment_id', referencedColumnName: 'id' }])
  assignment: DayAssignments;

  @ManyToOne(() => Reservations, (reservations) => reservations.fileLinks, {
    onDelete: 'CASCADE',
  })
  @JoinColumn([{ name: 'reservation_id', referencedColumnName: 'id' }])
  reservation: Reservations;

  @ManyToOne(() => TripFiles, (tripFiles) => tripFiles.fileLinks, {
    onDelete: 'CASCADE',
  })
  @JoinColumn([{ name: 'file_id', referencedColumnName: 'id' }])
  file: TripFiles;
}
