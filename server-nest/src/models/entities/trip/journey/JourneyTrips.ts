import { Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Trips } from '../Trips';
import { Journeys } from './Journeys';
import { TimestampedEntity } from '../../base/BaseEntity';

@Index('idx_journey_trips_journey', ['journeyId'], {})
@Entity('journey_trips')
export class JourneyTrips extends TimestampedEntity {
  @PrimaryColumn('int', { name: 'journey_id' })
  journeyId: number;

  @PrimaryColumn('int', { name: 'trip_id' })
  tripId: number;

  @ManyToOne(() => Trips, (trips) => trips.journeyTrips, {
    onDelete: 'CASCADE',
  })
  @JoinColumn([{ name: 'trip_id', referencedColumnName: 'id' }])
  trip: Trips;

  @ManyToOne(() => Journeys, (journeys) => journeys.journeyTrips, {
    onDelete: 'CASCADE',
  })
  @JoinColumn([{ name: 'journey_id', referencedColumnName: 'id' }])
  journey: Journeys;
}
