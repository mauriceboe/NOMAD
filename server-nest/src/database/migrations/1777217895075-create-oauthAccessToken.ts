import {
  type MigrationInterface,
  type QueryRunner,
  Table,
  TableColumn,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class CreateOauthAccessToken1777217895075 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'oauthAccessToken',
        columns: [
          {
            name: 'id',
            type: 'text',
            isPrimary: true,
          },
          {
            name: 'token',
            type: 'text',
            isNullable: true,
            isUnique: true,
          },
          {
            name: 'clientId',
            type: 'text',
          },
          {
            name: 'sessionId',
            type: 'text',
            isNullable: true,
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
            name: 'refreshId',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'expiresAt',
            type: 'datetime',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'datetime',
            isNullable: true,
          },
          {
            name: 'scopes',
            type: 'text',
          },
        ],
      }),
    );

    await queryRunner.createForeignKey(
      'oauthAccessToken',
      new TableForeignKey({
        columnNames: ['clientId'],
        referencedTableName: 'oauthClient',
        referencedColumnNames: ['clientId'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'oauthAccessToken',
      new TableForeignKey({
        columnNames: ['sessionId'],
        referencedTableName: 'session',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );

    await queryRunner.createForeignKey(
      'oauthAccessToken',
      new TableForeignKey({
        columnNames: ['userId'],
        referencedTableName: 'user',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'oauthAccessToken',
      new TableForeignKey({
        columnNames: ['refreshId'],
        referencedTableName: 'oauthRefreshToken',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('oauthAccessToken');
  }
}
