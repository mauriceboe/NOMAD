import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { PackingTemplateCategories } from './PackingTemplateCategories';
import { IntSortableBaseEntity } from '../../base/BaseEntity';

@Entity('packing_template_items')
export class PackingTemplateItems extends IntSortableBaseEntity {
  @Column({ name: 'name' })
  name: string;

  @ManyToOne(
    () => PackingTemplateCategories,
    (packingTemplateCategories) =>
      packingTemplateCategories.packingTemplateItems,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn([{ name: 'category_id', referencedColumnName: 'id' }])
  category: PackingTemplateCategories;
}
