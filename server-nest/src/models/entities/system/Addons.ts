import { Column, Entity } from 'typeorm';
import { StringSortableBaseEntity } from '../base/BaseEntity';

@Entity('addons')
export class Addons extends StringSortableBaseEntity {
  @Column({ name: 'name' })
  name: string;

  @Column({ name: 'description', nullable: true })
  description: string | null;

  @Column({ name: 'type', default: 'global' })
  type: string;

  @Column({ name: 'icon', default: 'Puzzle' })
  icon: string | null;

  @Column('int', { name: 'enabled', default: 0 })
  enabled: number;

  @Column('simple-json', { name: 'config', nullable: true, default: null })
  config: Record<string, unknown> | null;
}
