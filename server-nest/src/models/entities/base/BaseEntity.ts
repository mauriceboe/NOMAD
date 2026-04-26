import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  PrimaryColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

// Layer 1 — timestamps only, always present
export abstract class TimestampedEntity {
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

export abstract class TimestampedSortableEntity extends TimestampedEntity {
  @Column('int', { name: 'sort_order', default: 0 })
  sortOrder: number;
}

// Layer 2 — adds soft delete
export abstract class SoftDeletableEntity extends TimestampedEntity {
  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt: Date | null;
}

// Layer 3a — adds integer PK to timestamped entity
export abstract class IntBaseEntity extends TimestampedEntity {
  @PrimaryGeneratedColumn()
  id: number;
}

export abstract class IntSortableBaseEntity extends IntBaseEntity {
  @Column('int', { name: 'sort_order', default: 0 })
  sortOrder: number;
}

// Layer 3b — adds integer PK + soft delete
export abstract class SoftDeletableIntBaseEntity extends SoftDeletableEntity {
  @PrimaryGeneratedColumn()
  id: number;
}

// Layer 3c — natural/business string PK (e.g. country code, slug)
export abstract class StringBaseEntity extends TimestampedEntity {
  @PrimaryColumn({ name: 'id' })
  id: string;
}

export abstract class StringSortableBaseEntity extends StringBaseEntity {
  @Column('int', { name: 'sort_order', default: 0 })
  sortOrder: number;
}

// Layer 3d — natural string PK + soft delete
export abstract class SoftDeletableStringBaseEntity extends SoftDeletableEntity {
  @PrimaryColumn({ name: 'id' })
  id: string;
}
