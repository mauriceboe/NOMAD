import {
  type MigrationInterface,
  type QueryRunner,
  Table,
  TableColumn,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class CreateOauthRefreshToken1777217820713 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'oauthRefreshToken',
        columns: [
          {
            name: 'id',
            type: 'text',
            isPrimary: true,
          },
          {
            name: 'token',
            type: 'text',
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
          },
          {
            name: 'referenceId',
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
            name: 'revoked',
            type: 'datetime',
            isNullable: true,
          },
          {
            name: 'authTime',
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
      'oauthRefreshToken',
      new TableForeignKey({
        columnNames: ['clientId'],
        referencedTableName: 'oauthClient',
        referencedColumnNames: ['clientId'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'oauthRefreshToken',
      new TableForeignKey({
        columnNames: ['sessionId'],
        referencedTableName: 'session',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );

    await queryRunner.createForeignKey(
      'oauthRefreshToken',
      new TableForeignKey({
        columnNames: ['userId'],
        referencedTableName: 'user',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('oauthRefreshToken');
  }
}
