import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { Places } from './Places';
import { IntBaseEntity } from '../base/BaseEntity';

@Index('idx_place_regions_region', ['regionCode'], {})
@Index('idx_place_regions_country', ['countryCode'], {})
@Entity('place_regions')
export class PlaceRegions extends IntBaseEntity {
  @Column({ name: 'country_code' })
  countryCode: string;

  @Column({ name: 'region_code' })
  regionCode: string;

  @Column({ name: 'region_name' })
  regionName: string;

  @ManyToOne(() => Places, (places) => places.placeRegions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn([{ name: 'place_id', referencedColumnName: 'id' }])
  place: Places;
}
