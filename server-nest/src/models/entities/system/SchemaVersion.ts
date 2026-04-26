import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('schema_version')
export class SchemaVersion {
  @PrimaryColumn('int', { name: 'id' })
  id: number | null;

  @Column('int', { name: 'version' })
  version: number;
}
