import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { PackingTemplateCategories } from './PackingTemplateCategories';
import { IntBaseEntity } from '../../base/BaseEntity';
import { SqliteUsers } from '../../old-entities/SqliteUsers';

@Entity('packing_templates')
export class PackingTemplates extends IntBaseEntity {
  @Column({ name: 'name' })
  name: string;

  @ManyToOne(() => SqliteUsers, (users) => users.packingTemplates, {
    onDelete: 'CASCADE',
  })
  @JoinColumn([{ name: 'created_by', referencedColumnName: 'id' }])
  createdBy: SqliteUsers;

  @OneToMany(
    () => PackingTemplateCategories,
    (packingTemplateCategories) => packingTemplateCategories.template,
  )
  packingTemplateCategories: PackingTemplateCategories[];
}
