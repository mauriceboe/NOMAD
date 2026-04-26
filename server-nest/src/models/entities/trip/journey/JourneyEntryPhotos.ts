import { Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { JourneyPhotos } from './JourneyPhotos';
import { JourneyEntries } from './JourneyEntries';
import { TimestampedSortableEntity } from '../../base/BaseEntity';

@Index('idx_journey_entry_photos_photo', ['journeyPhotoId'], {})
@Index('idx_journey_entry_photos_entry', ['entryId'], {})
@Entity('journey_entry_photos')
export class JourneyEntryPhotos extends TimestampedSortableEntity {
  @PrimaryColumn('int', { name: 'entry_id' })
  entryId: number;

  @PrimaryColumn('int', { name: 'journey_photo_id' })
  journeyPhotoId: number;

  @ManyToOne(
    () => JourneyPhotos,
    (journeyPhotos) => journeyPhotos.journeyEntryPhotos,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn([{ name: 'journey_photo_id', referencedColumnName: 'id' }])
  journeyPhoto: JourneyPhotos;

  @ManyToOne(
    () => JourneyEntries,
    (journeyEntries) => journeyEntries.journeyEntryPhotos,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn([{ name: 'entry_id', referencedColumnName: 'id' }])
  entry: JourneyEntries;
}
