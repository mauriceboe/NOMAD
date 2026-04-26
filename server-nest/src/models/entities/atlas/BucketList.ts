import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { IntBaseEntity } from '../base/BaseEntity';
import { SqliteUsers } from '../old-entities/SqliteUsers';

@Entity('bucket_list')
export class BucketList extends IntBaseEntity {
  @Column({ name: 'name' })
  name: string;

  @Column({ name: 'lat', nullable: true })
  lat: number | null;

  @Column({ name: 'lng', nullable: true })
  lng: number | null;

  @Column({ name: 'country_code', nullable: true })
  countryCode: string | null;

  @Column('text', { name: 'notes', nullable: true })
  notes: string | null;

  @Column({
    name: 'target_date',
    nullable: true,
    default: null,
  })
  targetDate: string | null;

  @ManyToOne(() => SqliteUsers, (users) => users.bucketLists, {
    onDelete: 'CASCADE',
  })
  @JoinColumn([{ name: 'user_id', referencedColumnName: 'id' }])
  user: SqliteUsers;
}
