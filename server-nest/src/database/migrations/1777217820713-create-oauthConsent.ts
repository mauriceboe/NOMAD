import {
  type MigrationInterface,
  type QueryRunner,
  Table,
  TableColumn,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class CreateOauthConsent1777217820713 implements MigrationInterface {
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
          },
          {
            name: 'userId',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'referenceId',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'scopes',
            type: 'text',
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

    await queryRunner.createForeignKey(
      'oauthConsent',
      new TableForeignKey({
        columnNames: ['clientId'],
        referencedTableName: 'oauthClient',
        referencedColumnNames: ['clientId'],
        onDelete: 'CASCADE',
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
