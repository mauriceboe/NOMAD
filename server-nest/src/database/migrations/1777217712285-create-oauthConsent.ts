import {
  type MigrationInterface,
  type QueryRunner,
  Table,
  TableColumn,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class CreateOauthConsent1777217712285 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'oauthConsent',
        columns: [
          {
            name: 'id',
            type: 'text',
            isPrimary: true,
          },
          {
            name: 'clientId',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'userId',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'scopes',
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
          {
            name: 'consentGiven',
            type: 'boolean',
            isNullable: true,
          },
        ],
      }),
    );

    await queryRunner.createIndex(
      'oauthConsent',
      new TableIndex({
        name: 'oauthConsent_clientId_idx',
        columnNames: ['clientId'],
      }),
    );

    await queryRunner.createForeignKey(
      'oauthConsent',
      new TableForeignKey({
        columnNames: ['clientId'],
        referencedTableName: 'oauthApplication',
        referencedColumnNames: ['clientId'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createIndex(
      'oauthConsent',
      new TableIndex({
        name: 'oauthConsent_userId_idx',
        columnNames: ['userId'],
      }),
    );

    await queryRunner.createForeignKey(
      'oauthConsent',
      new TableForeignKey({
        columnNames: ['userId'],
        referencedTableName: 'user',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('oauthConsent');
  }
}
