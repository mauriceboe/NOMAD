import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { PhotoProviders } from './PhotoProviders';
import { IntSortableBaseEntity } from '../../base/BaseEntity';

@Entity('photo_provider_fields')
export class PhotoProviderFields extends IntSortableBaseEntity {
  @Column({ name: 'field_key' })
  fieldKey: string;

  @Column({ name: 'label' })
  label: string;

  @Column({ name: 'input_type', default: 'text' })
  inputType: string;

  @Column({ name: 'placeholder', nullable: true })
  placeholder: string | null;

  @Column({ name: 'hint', nullable: true })
  hint: string | null;

  @Column({ name: 'required', nullable: true, default: false })
  required: boolean;

  @Column({ name: 'secret', nullable: true, default: false })
  secret: boolean;

  @Column({ name: 'settings_key', nullable: true })
  settingsKey: string | null;

  @Column({ name: 'payload_key', nullable: true })
  payloadKey: string | null;

  @ManyToOne(
    () => PhotoProviders,
    (photoProviders) => photoProviders.photoProviderFields,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn([{ name: 'provider_id', referencedColumnName: 'id' }])
  provider: PhotoProviders;
}
