import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('app_settings')
export class AppSettings {
  @PrimaryColumn({ name: 'key' })
  declare id: string;

  @Column({ name: 'value', nullable: true })
  value: string | null;
}
