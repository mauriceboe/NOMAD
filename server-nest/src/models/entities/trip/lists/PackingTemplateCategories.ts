import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { PackingTemplates } from './PackingTemplates';
import { PackingTemplateItems } from './PackingTemplateItems';
import { IntSortableBaseEntity } from '../../base/BaseEntity';

@Entity('packing_template_categories')
export class PackingTemplateCategories extends IntSortableBaseEntity {
  @Column({ name: 'name' })
  name: string;

  @ManyToOne(
    () => PackingTemplates,
    (packingTemplates) => packingTemplates.packingTemplateCategories,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn([{ name: 'template_id', referencedColumnName: 'id' }])
  template: PackingTemplates;

  @OneToMany(
    () => PackingTemplateItems,
    (packingTemplateItems) => packingTemplateItems.category,
  )
  packingTemplateItems: PackingTemplateItems[];
}
