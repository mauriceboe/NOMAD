import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
} from 'typeorm';
import { Journeys } from './Journeys';
import { IntBaseEntity } from '../../base/BaseEntity';
import { SqliteUsers } from '../../old-entities/SqliteUsers';

@Index('idx_journey_share_journey', ['journeyId'], { unique: true })
@Entity('journey_share_tokens')
export class JourneyShareTokens extends IntBaseEntity {
  @Column('int', { name: 'journey_id', unique: true })
  journeyId: number;

  @Column({ name: 'token', unique: true })
  token: string;

  @Column({
    name: 'share_timeline',
    nullable: true,
    default: true,
  })
  shareTimeline: boolean | null;

  @Column({
    name: 'share_gallery',
    nullable: true,
    default: true,
  })
  shareGallery: boolean | null;

  @Column({ name: 'share_map', nullable: true, default: true })
  shareMap: boolean | null;

  @ManyToOne(() => SqliteUsers, (users) => users.journeyShareTokens)
  @JoinColumn([{ name: 'created_by', referencedColumnName: 'id' }])
  createdBy: SqliteUsers;

  @OneToOne(() => Journeys, (journeys) => journeys.journeyShareTokens, {
    onDelete: 'CASCADE',
  })
  @JoinColumn([{ name: 'journey_id', referencedColumnName: 'id' }])
  journey: Journeys;
}
