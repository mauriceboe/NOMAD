import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BudgetItems } from './BudgetItems';
import { SqliteUsers } from '../../old-entities/SqliteUsers';
import { IntBaseEntity } from '../../base/BaseEntity';

@Index('idx_budget_item_members_user', ['userId'], {})
@Index('idx_budget_item_members_item', ['budgetItemId'], {})
@Entity('budget_item_members')
export class BudgetItemMembers extends IntBaseEntity {
  @Column('int', { name: 'budget_item_id' })
  budgetItemId: number;

  @Column('int', { name: 'user_id' })
  userId: number;

  @Column({ name: 'paid', default: false })
  paid: boolean;

  @ManyToOne(() => SqliteUsers, (users) => users.budgetItemMembers, {
    onDelete: 'CASCADE',
  })
  @JoinColumn([{ name: 'user_id', referencedColumnName: 'id' }])
  user: SqliteUsers;

  @ManyToOne(
    () => BudgetItems,
    (budgetItems) => budgetItems.budgetItemMembers,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn([{ name: 'budget_item_id', referencedColumnName: 'id' }])
  budgetItem: BudgetItems;
}
