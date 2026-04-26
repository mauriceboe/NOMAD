import { Column, Entity, OneToMany } from 'typeorm';
import { PhotoProviderFields } from './PhotoProviderFields';
import { IntSortableBaseEntity } from '../../base/BaseEntity';

@Entity('photo_providers')
export class PhotoProviders extends IntSortableBaseEntity {
  @Column({ name: 'name' })
  name: string;

  @Column('text', { name: 'description', nullable: true })
  description: string | null;

  @Column({ name: 'icon', nullable: true, default: 'Image' })
  icon: string | null;

  @Column({ name: 'enabled', nullable: true, default: false })
  enabled: boolean;

  @OneToMany(
    () => PhotoProviderFields,
    (photoProviderFields) => photoProviderFields.provider,
  )
  photoProviderFields: PhotoProviderFields[];
}
