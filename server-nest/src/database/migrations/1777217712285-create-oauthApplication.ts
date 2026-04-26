import {
  type MigrationInterface,
  type QueryRunner,
  Table,
  TableColumn,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class CreateOauthApplication1777217712285 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'oauthApplication',
        columns: [
          {
            name: 'id',
            type: 'text',
            isPrimary: true,
          },
          {
            name: 'name',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'icon',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'clientId',
            type: 'text',
            isNullable: true,
            isUnique: true,
          },
          {
            name: 'clientSecret',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'redirectUrls',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'type',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'disabled',
            type: 'boolean',
            isNullable: true,
            default: false,
          },
          {
            name: 'userId',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'datetime',
            isNullable: true,
          },
          {
            name: 'updatedAt',
            type: 'datetime',
            isNullable: true,
          },
        ],
      }),
    );

    await queryRunner.createIndex(
      'oauthApplication',
      new TableIndex({
        name: 'oauthApplication_userId_idx',
        columnNames: ['userId'],
      }),
    );

    await queryRunner.createForeignKey(
      'oauthApplication',
      new TableForeignKey({
        columnNames: ['userId'],
        referencedTableName: 'user',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('oauthApplication');
  }
}
