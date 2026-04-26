import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { TrekPhotos } from './TrekPhotos';
import { Journeys } from './Journeys';
import { JourneyEntryPhotos } from './JourneyEntryPhotos';
import { IntSortableBaseEntity } from '../../base/BaseEntity';

@Index('idx_journey_photos_journey', ['journeyId'], {})
@Entity('journey_photos')
export class JourneyPhotos extends IntSortableBaseEntity {
  @Column('int', { name: 'journey_id' })
  journeyId: number;

  @Column({ name: 'caption', nullable: true })
  caption: string | null;

  @Column({ name: 'shared', default: false })
  shared: boolean;

  @Column({ name: 'provider', nullable: true })
  provider: string | null;

  @Column({ name: 'asset_id', nullable: true })
  assetId: string | null;

  @Column('int', { name: 'owner_id', nullable: true })
  ownerId: number | null;

  @ManyToOne(() => TrekPhotos, (trekPhotos) => trekPhotos.journeyPhotos, {
    onDelete: 'CASCADE',
  })
  @JoinColumn([{ name: 'photo_id', referencedColumnName: 'id' }])
  photo: TrekPhotos;

  @ManyToOne(() => Journeys, (journeys) => journeys.journeyPhotos, {
    onDelete: 'CASCADE',
  })
  @JoinColumn([{ name: 'journey_id', referencedColumnName: 'id' }])
  journey: Journeys;

  @OneToMany(
    () => JourneyEntryPhotos,
    (journeyEntryPhotos) => journeyEntryPhotos.journeyPhoto,
  )
  journeyEntryPhotos: JourneyEntryPhotos[];
}
