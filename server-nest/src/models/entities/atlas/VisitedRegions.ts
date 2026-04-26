import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { IntBaseEntity } from '../base/BaseEntity';
import { SqliteUsers } from '../old-entities/SqliteUsers';

@Index('idx_visited_regions_country', ['countryCode'], {})
@Entity('visited_regions')
export class VisitedRegions extends IntBaseEntity {
  @Column({ name: 'region_code' })
  regionCode: string;

  @Column({ name: 'region_name' })
  regionName: string;

  @Column({ name: 'country_code' })
  countryCode: string;

  @ManyToOne(() => SqliteUsers, (users) => users.visitedRegions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn([{ name: 'user_id', referencedColumnName: 'id' }])
  user: SqliteUsers;
}
